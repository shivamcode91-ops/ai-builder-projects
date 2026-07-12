# Vitalis — Build Specification

> A native iOS health app that turns Helio Strap (via Apple Health) + InBody scans into a single north-star metric: **Biological Age**. On-device only. No backend.

**Target:** iOS 17+ · SwiftUI · HealthKit · Swift 5.9+
**Stack decision:** Native SwiftUI (not MAUI) — required for clean HealthKit access, App Store distribution, and best Helio/Apple Health integration.
**Processing:** 100% on-device. No servers, no cloud, no accounts. All algorithms run locally.

---

## 0. How to use this document (for Claude Code)

Build in the **phase order** in §9. Do not scaffold everything at once. After each phase, the app must compile and run in the simulator. Confirm HealthKit reads work on a **real device** (HealthKit returns no data in the simulator for most types).

Read this whole file before writing code. The data-flow rules in §3 are the spine of the app — get them right first.

---

## 1. Product summary

| | |
|---|---|
| **North star** | Biological Age (years) — derived, displayed everywhere as the lead metric |
| **Inputs** | Apple Health (heart rate, HRV, RHR, respiratory rate, SpO₂, sleep, steps, active energy, VO₂max, workouts) + manual InBody scan import |
| **Pillars** | Recovery · Strain · Sleep (Whoop model) + Body composition (InBody) |
| **Differentiator** | A coach grounded in the user's *own* numbers, and InBody data that no wrist wearable can produce |
| **Tabs** | Today · Recovery · Strain · Body · Coach |

The HTML prototype (`vitalis3.html`) is the visual + interaction reference. Match its layout, hierarchy, and component breakdown.

---

## 2. Where the data comes from (critical)

**The app never talks to the Helio Strap directly.** The chain is:

```
Helio Strap → Zepp app → Apple Health (HealthKit) → Vitalis (reads)
InBody printout → user photo → OCR / manual entry → local store
```

### 2a. Pre-flight check (document this for the user, do not code around it)
Before any HealthKit value is reliable, the user must, in the **Zepp app**, enable Apple Health sync for every category. Vitalis can only read what Zepp actually writes. If a metric is missing in Apple Health, it cannot appear in Vitalis — surface a clear empty state, never fake a value.

### 2b. HealthKit types to request (read-only)

| App concept | HKQuantityType / category | Notes |
|---|---|---|
| Resting HR | `.restingHeartRate` | daily |
| HRV | `.heartRateVariabilitySDNN` | SDNN ms; Apple stores SDNN, not rMSSD — see §4 |
| Heart rate (live/series) | `.heartRate` | for zones, workouts |
| Respiratory rate | `.respiratoryRate` | sleep-time samples |
| Blood oxygen | `.oxygenSaturation` | may be absent depending on Zepp sync |
| Body temperature | `.bodyTemperature` / `.appleSleepingWristTemperature` | baseline deviation |
| Sleep | `.sleepAnalysis` (category) | stages: inBed/asleepCore/Deep/REM/awake |
| Steps | `.stepCount` | daily sum |
| Active energy | `.activeEnergyBurned` | daily sum |
| Basal energy | `.basalEnergyBurned` | optional; InBody BMR preferred |
| VO₂max | `.vo2Max` | key for bio-age |
| Workouts | `HKWorkout` via `HKWorkoutType` | strain + sessions |
| Body mass | `.bodyMass` | reconcile with InBody weight |
| Body fat % | `.bodyFatPercentage` | InBody is source of truth |
| Lean body mass | `.leanBodyMass` | from InBody |

Request **read** authorization only. Write nothing back in v1.

### 2c. What is NOT in HealthKit (must come from InBody or be derived)
Segmental lean mass, visceral fat level, protein/mineral/body-water breakdown, InBody score, BMR (InBody's is better than HK basal), waist-hip ratio. These come **only** from the InBody import (§5).

### 2d. Derived-only (Vitalis computes, no sensor provides)
Biological Age (§4), Recovery score (§4b), Strain score (§4c), HybridCharge-style energy, PAI. These are *our* algorithms over the raw inputs.

---

## 3. Data-flow & refresh rules

1. **On launch / foreground:** run a sync pass. Query each HealthKit type for the windows below.
2. **Background:** register `HKObserverQuery` + `enableBackgroundDelivery` for HRV, RHR, sleep, workouts so the app refreshes the morning score without being opened. (Document the entitlement requirement.)
3. **Windows:**
   - Today's tiles: today `00:00 → now`.
   - Baselines: trailing **30 days** (rolling mean + SD) for HRV, RHR, respiratory rate, sleep duration, skin temp.
   - Trends (period toggles 1D/1W/1M/3M/6M): query the matching range, downsample for charts.
4. **Recovery is computed once per day**, anchored to the main sleep period's end (morning). It does not change through the day. **Strain accumulates** through the day.
5. **Caching:** persist computed daily scores + InBody scans locally (SwiftData or Core Data — pick SwiftData for iOS 17). Raw HealthKit samples are re-queried, not stored.
6. **Empty/partial data:** if a baseline has <7 days of history, mark scores "calibrating" and widen confidence. Never block the UI; show what exists.

---

## 4. The algorithms (compute locally)

> These are **estimates**, not medical figures. Surface a "How this is computed" explainer (Coach has a prompt for it). Keep each formula in its own pure, unit-tested function so it can be tuned without touching UI.

### 4a. Biological Age (north star)
Blend the markers most associated with physiological aging, each scored against age/sex norms, then map the composite to an age offset.

```
inputs (all normalized to a 0–100 sub-score vs age+sex norms):
  vo2max         (strongest weight — cardiorespiratory fitness)
  hrv_sdnn       (autonomic function)
  rhr            (cardiovascular efficiency, inverted)
  sleep_quality  (30-day efficiency + duration vs need)
  body_fat_pct   (from InBody if present, else HK)
  activity       (steps / active-energy consistency)

weights (v1, tune later):
  vo2max .30, hrv .25, rhr .20, sleep .10, bodyfat .10, activity .05

composite = Σ(subscore_i * weight_i)            // 0–100, higher = younger
bio_age   = chronological_age - k * (composite - 50) / 50
            // k ≈ 12 (caps swing ~±12 yrs); clamp to [chronological-15, chronological+15]
```
- Sub-scores use published age/sex norm tables (VO₂max, HRV-by-age, RHR). Ship the tables as a bundled JSON; cite sources in code comments.
- Recompute daily; show a 6-month trend on the Body tab.
- If VO₂max is missing, estimate from RHR + age (non-exercise model) and flag lower confidence.

### 4b. Recovery score (0–100)
Whoop-style. Weighted blend of **today vs personal baseline**:
```
HRV vs baseline      40%   (higher = better)
RHR vs baseline      25%   (lower = better)
Respiratory rate     15%   (stable = better)
Sleep performance    15%   (last night, see 4d)
Skin temp / SpO₂      5%   (deviation penalized)
```
Output bands: green ≥67, yellow 34–66, red <34. Show the per-input contribution + weighting (the prototype's Recovery screen does this).

### 4c. Strain score (0–21)
Logarithmic cardiovascular load, Borg-scale-like (Whoop uses 0–21).
```
Accumulate from heart-rate time-in-zone across the day + workouts.
Map cumulative weighted HR reserve to a 0–21 curve (logistic).
Daily target band derived from today's Recovery (green → higher target).
```
Show HR zones (Z1–Z5 time) and per-session strain.

### 4d. Sleep performance (0–100)
`asleep_duration / sleep_need`, adjusted for efficiency, disturbances, and stage balance (deep + REM). Sleep need = baseline + strain-driven debt.

### 4e. HybridCharge / energy (0–100) and PAI
- Energy: starts high after good sleep, depletes with strain/stress, partial recovery on rest. Simple battery model.
- PAI: 7-day rolling cardio score from HR-elevated minutes (HUNT-study style). Above 100 = optimal. Implement as a documented approximation.

---

## 5. InBody import (manual + OCR)

InBody printouts have a fixed layout (the user has an **InBody 260**). Two entry paths:

1. **Photo + OCR (primary):** user photographs the printout → `Vision` framework (`VNRecognizeTextRequest`) → parse known field labels → pre-fill a review form → user confirms → save.
2. **Manual entry (fallback / always available):** a form with every field below.

### Fields to capture (InBody 260)
```
profile:    height_cm, age, sex, test_datetime
core:       weight_kg, smm_kg (skeletal muscle), body_fat_mass_kg, pbf_pct, bmi
            inbody_score (0–100 / 100+)
composition: total_body_water_l, protein_kg, mineral_kg, fat_free_mass_kg
metabolic:  bmr_kcal, recommended_intake_kcal, visceral_fat_level,
            waist_hip_ratio, smi
segmental_lean_kg:  arm_L, arm_R, trunk, leg_L, leg_R   (+ normal/under/over flag each)
segmental_fat_kg:   arm_L, arm_R, trunk, leg_L, leg_R   (optional)
targets:    target_weight_kg, weight_control_kg, fat_control_kg, muscle_control_kg
```
- Store each scan as a dated record → enables the Body-tab trend + Coach's "compare to last scan."
- **Range flags:** mark values outside InBody's printed normal range (e.g. the user's protein 8.5 vs 8.7–10.7 → "below range"). Surface this flag in the UI and feed it to the coach.
- Reconcile with HealthKit body mass/fat: InBody is source of truth when a recent scan exists.

### Seed data (the user's actual Jun 3 2026 scan — use for initial dev/testing)
```
height_cm 162 · age 24 · sex M · score 73
weight 51.7 · smm 23.5 · body_fat_mass 9.0 · pbf 17.3 · bmi 19.7
tbw 31.4 · protein 8.5 (below 8.7–10.7) · mineral 2.81 · ffm 42.7
bmr 1293 · rec_intake 2567 · visceral_fat_level 3 · whr 0.84 · smi 6.5
seg_lean: armL 2.15 armR 2.18 trunk 19.1 legL 6.36 legR 6.33  (all Normal)
seg_fat:  armL 0.5 armR 0.5 trunk 4.0 legL 1.5 legR 1.5
targets: target_weight 57.7 · weight_control +6.0 · fat_control -0.3 · muscle_control +6.3
```

---

## 6. Screens (match `vitalis3.html`)

Feature-module architecture (mirrors the reference repo split):
`Features/Today`, `Features/Recovery`, `Features/Strain`, `Features/Body`, `Features/Coach`, plus `Core/Health`, `Core/InBody`, `Core/Scoring`, `Core/Store`, `DesignSystem`.

1. **Today** — bio-age hero + spark; 3 score cards (tap → drill to screen); coach note; activity list (steps, calories, HybridCharge, PAI).
2. **Recovery** — period toggle (1D–6M); 7-day avg + trend; today's score; **inputs with weightings**; coach note.
3. **Strain** — period toggle; today's strain; **HR zone breakdown**; sessions list; coach note.
4. **Body** — InBody score + stats; BMI & PBF gauges; **segmental body map**; composition table with range flags; InBody plan note; **import card**.
5. **Coach** — grounded Q&A that **cites which data it used**; an "Ask about your data" bar; suggested prompts. (v1: on-device templated/rule-based answers over the user's metrics — see §7. No cloud LLM.)

---

## 7. Coach (on-device, v1)

No backend in v1, so the coach is a **local insight engine**, not a cloud LLM:
- A set of rule/template generators that read the computed scores + InBody flags and emit natural-language insights (e.g. protein-below-range + muscle-gain target → the protein advice).
- Each insight records which data points it used → render as source chips (the prototype shows `recovery · today`, `inbody · jun 3`).
- The "Ask" bar maps free text to the nearest insight intent (keyword/intent match) and returns the matching generated answer; if no match, return a graceful "I can't answer that from your data yet."
- **Design the boundary cleanly** so a future cloud RAG (Apple Foundation Models on-device LLM, or a server) can swap in behind the same `CoachService` protocol without UI changes.

---

## 8. Design system

Port from the prototype exactly:
- **Theme:** dark. Background `#0d0f12`, surfaces `#15181d`/`#1c2026`, hairlines `#262b32`.
- **Accent:** single warm coral `#e8765a`. Status: good `#5ec98a`, warn `#e8b15a`, cool `#6fa8d4`, muted-violet `#8a92e0`.
- **Type:** display = a serif with character (prototype uses *Instrument Serif*; choose an SF-friendly equivalent or bundle it). Body = system/Geist-like sans. Numbers = monospaced (SF Mono) for tabular alignment.
- **No glow, no gradient heroes, no donut rings, no emoji icons.** Flat cards, thin SVG/Swift Charts lines, line icons (SF Symbols).
- Charts: use **Swift Charts**. Keep them thin-stroke, minimal axes.
- Components to build once: `ScoreCard`, `MetricRow`, `HeroCard`, `CoachNote`, `PeriodToggle`, `GaugeBar`, `SegmentalBodyMap`, `DataTable`, `SourceChips`.

---

## 9. Build order (phased — compile & run after each)

**Phase 1 — Skeleton.** Xcode project, 5-tab `TabView`, design-system tokens + core components with mock data. No HealthKit yet. Matches the prototype visually.

**Phase 2 — HealthKit read.** Authorization flow + `HealthService` that fetches today's values and 30-day baselines for the types in §2b. Wire Today's tiles + Recovery inputs to real data on a physical device. Empty states.

**Phase 3 — Scoring.** Implement §4 as pure functions with unit tests. Compute Recovery, Strain, Sleep, Biological Age. Persist daily results (SwiftData).

**Phase 4 — InBody.** Manual-entry form + local store + Body screen (gauges, segmental map, table, flags, plan). Seed with the §5 data.

**Phase 5 — InBody OCR.** Vision text recognition → field parser → review/confirm form.

**Phase 6 — Coach.** Local insight engine + source chips + ask bar, behind a `CoachService` protocol.

**Phase 7 — Trends, background refresh, polish.** Period toggles wired to ranged queries, `HKObserverQuery` background delivery, widgets (optional), settings, "how it's computed" explainers.

---

## 10. Guardrails

- **Estimates, not diagnoses.** Bio-age/recovery are wellness estimates. Add a one-line disclaimer + a detailed explainer. No medical claims.
- **Privacy:** all data on-device; nothing leaves the phone in v1. State this plainly in onboarding. Add the required HealthKit usage strings to `Info.plist` (`NSHealthShareUsageDescription`).
- **Honesty over fake data:** if Apple Health lacks a metric, show an empty/calibrating state — never synthesize a number.
- **Capabilities/entitlements:** enable HealthKit capability; for background scores, add HealthKit background delivery.
- **Testing:** HealthKit needs a real device. Keep a mock `HealthService` for simulator/SwiftUI previews.

---

## 11. Open decisions to revisit (not blockers for v1)
- Bundle a custom display serif vs. use New York (SF serif).
- Whether to write a derived "Biological Age" back to HealthKit as a custom metric (skip in v1).
- Future cloud RAG coach (would need a backend + the $99 Apple Developer Program is already needed for device/TestFlight regardless).
