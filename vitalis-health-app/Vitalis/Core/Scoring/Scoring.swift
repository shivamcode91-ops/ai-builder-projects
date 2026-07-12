import Foundation

/// Pure scoring functions (§4). No HealthKit, no SwiftUI, no I/O — every input is a
/// plain value so each formula is unit-testable in isolation and tunable without
/// touching the UI. `HealthStore` feeds these from `HealthReadings` + the latest InBody.
enum Scoring {

    // MARK: - 4b. Recovery (0–100)

    struct RecoveryInputs {
        var hrv: Double?;            var hrvBaseline: Double?
        var rhr: Double?;            var rhrBaseline: Double?
        var respiratory: Double?;    var respiratoryBaseline: Double?
        var sleepPerformance: Int?            // 0–100, from `sleepPerformance(...)`
        var wristTempDelta: Double?           // °C vs baseline
        var spo2: Double?                     // 0...1
    }

    /// Whoop-style weighted blend of today-vs-baseline. Returns nil when the heart
    /// inputs (HRV/RHR, 65% of the weight) are missing — we never fake a number (§10).
    /// Weights renormalize over whichever inputs are present.
    static func recovery(_ i: RecoveryInputs) -> Int? {
        var weighted = 0.0, totalWeight = 0.0
        func add(_ sub: Double?, _ weight: Double) {
            guard let sub else { return }
            weighted += min(100, max(0, sub)) * weight
            totalWeight += weight
        }

        // HRV vs baseline (higher = better). ±30% around baseline maps ~0→100.
        let hrvSub = ratioSubscore(i.hrv, i.hrvBaseline, span: 0.30, higherBetter: true)
        // RHR vs baseline (lower = better).
        let rhrSub = ratioSubscore(i.rhr, i.rhrBaseline, span: 0.15, higherBetter: false)
        // Respiratory rate: stability around baseline is best (deviation penalized).
        let respSub = stabilitySubscore(i.respiratory, i.respiratoryBaseline, span: 0.20)
        // Skin-temp deviation + SpO₂.
        let tempSub = tempSpO2Subscore(tempDelta: i.wristTempDelta, spo2: i.spo2)

        add(hrvSub, 0.40)
        add(rhrSub, 0.25)
        add(respSub, 0.15)
        add(i.sleepPerformance.map(Double.init), 0.15)
        add(tempSub, 0.05)

        // Need the autonomic core (HRV or RHR) to say anything meaningful.
        guard hrvSub != nil || rhrSub != nil, totalWeight > 0 else { return nil }
        return Int((weighted / totalWeight).rounded())
    }

    // MARK: - 4d. Sleep performance (0–100)

    struct SleepInputs {
        var asleepSeconds: Double?
        var inBedSeconds: Double?
        var deepSeconds: Double?
        var remSeconds: Double?
        var needSeconds: Double                // baseline need + strain debt
    }

    /// asleep/need, adjusted for efficiency and deep+REM stage balance (§4d).
    static func sleepPerformance(_ i: SleepInputs) -> Int? {
        guard let asleep = i.asleepSeconds, i.needSeconds > 0 else { return nil }

        let duration = min(1.1, asleep / i.needSeconds)          // small credit for >need
        // Efficiency: asleep / in-bed (default 0.92 when in-bed unknown).
        let efficiency = i.inBedSeconds.map { $0 > 0 ? min(1, asleep / $0) : 0.92 } ?? 0.92
        // Stage balance: deep+REM ideally ~0.45 of sleep; score how close we are.
        let restorative = (i.deepSeconds ?? 0) + (i.remSeconds ?? 0)
        let stageRatio = asleep > 0 ? restorative / asleep : 0
        let stageScore = i.deepSeconds == nil && i.remSeconds == nil
            ? 1.0 : min(1, stageRatio / 0.45)

        let raw = (duration * 0.6 + efficiency * 0.25 + stageScore * 0.15) * 100
        return Int(min(100, max(0, raw)).rounded())
    }

    // MARK: - 4c. Strain (0–21)

    struct StrainInputs {
        var activeEnergy: Double?              // kcal today
        var workoutMinutes: Double             // summed workout duration
        var bmr: Double?                       // resting kcal/day, scales the load
        var recoveryScore: Int?                // drives the target band
    }

    /// v1 approximation: maps the day's cardiovascular load to a 0–21 logistic curve.
    /// Real intraday HR time-in-zone (§4c) lands in Phase 7; until then we proxy load
    /// from active energy (relative to BMR) plus workout duration. Returns nil with no
    /// load signal at all.
    static func strain(_ i: StrainInputs) -> Double? {
        let active = i.activeEnergy
        guard active != nil || i.workoutMinutes > 0 else { return nil }

        let bmr = i.bmr ?? 1500
        // Load units: active energy as a fraction of BMR + workout time contribution.
        let energyLoad = (active ?? 0) / max(bmr, 1) * 2.2
        let workoutLoad = i.workoutMinutes / 60.0 * 0.6
        let load = energyLoad + workoutLoad

        // Logistic map onto 0–21 (load ≈ 1.0 → ~10.5, the mid of the scale).
        let strain = 21.0 / (1.0 + exp(-1.6 * (load - 1.0)))
        return (strain * 10).rounded() / 10
    }

    /// Daily target band derived from Recovery (green → push harder). §4c.
    static func strainTarget(recovery: Int?) -> (low: Double, high: Double) {
        switch recovery {
        case .some(67...):   return (14, 18)
        case .some(34...66): return (10, 14)
        case .some:          return (6, 10)
        case nil:            return (12, 16)
        }
    }

    // MARK: - 4a. Biological Age (north star)

    struct BioAgeInputs {
        var chronologicalAge: Int
        var sex: BioSex
        var vo2max: Double?
        var hrv: Double?
        var rhr: Double?
        var sleepPerformance: Int?             // 0–100
        var bodyFatPct: Double?                // e.g. 17.3
        var steps: Double?
    }

    struct BioAgeResult {
        var years: Double
        var composite: Double                  // 0–100 (higher = younger)
        var deltaYears: Double                 // years − chronological (negative = younger)
        var lowConfidence: Bool                // VO₂max was estimated, not measured
    }

    private static let bioWeights: (vo2: Double, hrv: Double, rhr: Double,
                                    sleep: Double, fat: Double, activity: Double) =
        (0.30, 0.25, 0.20, 0.10, 0.10, 0.05)

    /// Blend age/sex-normed sub-scores into a composite, then map to an age offset (§4a).
    /// Needs at least the cardio core; returns nil if there's nothing to score on.
    static func biologicalAge(_ i: BioAgeInputs) -> BioAgeResult? {
        var weighted = 0.0, totalWeight = 0.0
        func add(_ sub: Double?, _ w: Double) {
            guard let sub else { return }
            weighted += sub * w; totalWeight += w
        }

        // VO₂max: measured, else estimate from RHR (lower confidence).
        var lowConfidence = false
        var vo2 = i.vo2max
        if vo2 == nil, let rhr = i.rhr {
            vo2 = Norms.estimatedVO2max(restingHR: rhr, age: i.chronologicalAge)
            lowConfidence = true
        }
        let vo2Sub = vo2.map { Norms.vo2maxSubscore($0, age: i.chronologicalAge, sex: i.sex) }
        let hrvSub = i.hrv.map { Norms.hrvSubscore($0, age: i.chronologicalAge) }
        let rhrSub = i.rhr.map { Norms.rhrSubscore($0, age: i.chronologicalAge, sex: i.sex) }
        let fatSub = i.bodyFatPct.map { Norms.bodyFatSubscore($0, sex: i.sex) }
        let actSub = i.steps.map { Norms.activitySubscore(steps: $0) }

        add(vo2Sub, bioWeights.vo2)
        add(hrvSub, bioWeights.hrv)
        add(rhrSub, bioWeights.rhr)
        add(i.sleepPerformance.map(Double.init), bioWeights.sleep)
        add(fatSub, bioWeights.fat)
        add(actSub, bioWeights.activity)

        guard vo2Sub != nil || hrvSub != nil || rhrSub != nil, totalWeight > 0 else { return nil }
        let composite = weighted / totalWeight                  // 0–100

        let k = 12.0
        let chrono = Double(i.chronologicalAge)
        var years = chrono - k * (composite - 50) / 50
        years = min(chrono + 15, max(chrono - 15, years))       // clamp ±15
        return BioAgeResult(years: (years * 10).rounded() / 10,
                            composite: composite,
                            deltaYears: years - chrono,
                            lowConfidence: lowConfidence)
    }

    // MARK: - Sub-score helpers

    /// Value vs baseline as a 0–100 score. `span` is the ± fractional swing that covers
    /// the full 50→0 / 50→100 range; `higherBetter` flips direction (RHR is inverted).
    static func ratioSubscore(_ value: Double?, _ baseline: Double?,
                              span: Double, higherBetter: Bool) -> Double? {
        guard let value, let baseline, baseline > 0 else { return nil }
        let delta = (value - baseline) / baseline          // e.g. +0.11 = 11% above
        let signed = higherBetter ? delta : -delta
        return min(100, max(0, 50 + signed / span * 50))
    }

    /// Closeness to baseline (any deviation penalized). 50 baseline ± `span` → 0/100 ends.
    static func stabilitySubscore(_ value: Double?, _ baseline: Double?, span: Double) -> Double? {
        guard let value, let baseline, baseline > 0 else { return nil }
        let dev = abs(value - baseline) / baseline
        return min(100, max(0, 100 - dev / span * 100))
    }

    private static func tempSpO2Subscore(tempDelta: Double?, spo2: Double?) -> Double? {
        guard tempDelta != nil || spo2 != nil else { return nil }
        var score = 100.0
        if let t = tempDelta { score -= min(60, abs(t) * 40) }      // 1°C off ≈ −40
        if let s = spo2 { score -= max(0, (0.97 - s) * 1000) }      // below 97% penalized
        return min(100, max(0, score))
    }
}
