import SwiftUI
import Observation
import SwiftData
import os

private let log = Logger(subsystem: "com.shivam.code.app", category: "HealthStore")

/// The single source of UI state. Owns auth flow, triggers sync passes, and maps raw
/// `HealthReadings` into the view models the screens render. Derived scores (Bio Age,
/// Recovery %, Strain) stay `nil` → "calibrating" until Phase 3 adds the scoring engine.
@MainActor
@Observable
final class HealthStore {

    enum Phase { case needsAuthorization, loading, ready, denied, unavailable }

    private(set) var phase: Phase = .needsAuthorization
    private(set) var readings: HealthReadings?
    private(set) var lastSynced: Date?

    // Display view models
    var bioAge: BioAge?
    var todayTiles: [ScoreTile] = []
    var todayCoachNote: String?
    var activity: [ActivityItem] = []
    var recovery: RecoveryData?
    var strain: StrainData?
    var latestInBody: InBodyScan
    var coachAnswers: [CoachAnswer] = []
    var coachPrompts: [String] = DemoData.coachPrompts

    private let reader: HealthReading
    private let modelContext: ModelContext?     // nil for previews/mocks

    init(reader: HealthReading, inBody: InBodyScan = .seedJun2026, context: ModelContext? = nil) {
        self.reader = reader
        self.latestInBody = inBody
        self.modelContext = context
    }

    /// Computed scores for one sync pass (any may be nil → calibrating).
    private struct Scores {
        var bioAge: Scoring.BioAgeResult?
        var recovery: Int?
        var strain: Double?
        var sleep: Int?
    }

    // MARK: - Lifecycle

    /// Called on launch / foreground. Checks auth, then syncs if allowed.
    func start() async {
        switch await reader.authorizationState() {
        case .unavailable: phase = .unavailable
        case .denied: phase = .denied
        case .authorized: await refresh()
        case .notDetermined: phase = .needsAuthorization
        }
    }

    func connect() async {
        let state = await reader.requestAuthorization()
        switch state {
        case .unavailable: phase = .unavailable
        case .denied: phase = .denied
        // HealthKit hides read denials, so after a request we always attempt a sync;
        // an empty result simply renders calibrating/empty states.
        default: await refresh()
        }
    }

    func refresh() async {
        phase = .loading
        let r: HealthReadings
        do { r = try await reader.fetchReadings() }
        catch {
            log.error("HealthKit fetch failed: \(error)")
            r = HealthReadings()
        }
        readings = r.hasAnyData ? r : nil
        let scores = computeScores(r)
        persist(scores)
        map(r, scores: scores, history: loadHistory())
        lastSynced = Date()
        phase = .ready
    }

    // MARK: - Scoring (§4)

    private func computeScores(_ r: HealthReadings) -> Scores {
        let calibrating = r.baselineDays < 7

        let need = r.sleepDurationBaseline ?? (8 * 3600)
        let sleep = Scoring.sleepPerformance(.init(
            asleepSeconds: r.asleepSeconds, inBedSeconds: r.inBedSeconds,
            deepSeconds: r.deepSeconds, remSeconds: r.remSeconds, needSeconds: need))

        // Recovery leans on personal baselines → suppress until ~7 days exist (§3.6).
        let recovery = calibrating ? nil : Scoring.recovery(.init(
            hrv: r.hrvSDNN, hrvBaseline: r.hrvBaseline,
            rhr: r.restingHR, rhrBaseline: r.rhrBaseline,
            respiratory: r.respiratoryRate, respiratoryBaseline: r.respiratoryBaseline,
            sleepPerformance: sleep, wristTempDelta: r.wristTempDelta, spo2: r.oxygenSaturation))

        let workoutMin = Double(r.workouts.reduce(0) { $0 + $1.durationMin })
        let strain = Scoring.strain(.init(
            activeEnergy: r.activeEnergy, workoutMinutes: workoutMin,
            bmr: Double(latestInBody.bmrKcal), recoveryScore: recovery))

        // Bio Age uses absolute age/sex norms (no baseline) → can show while calibrating.
        // InBody is the body-fat source of truth when a scan exists (§5).
        let bioAge = Scoring.biologicalAge(.init(
            chronologicalAge: latestInBody.age, sex: BioSex(latestInBody.sex),
            vo2max: r.vo2Max, hrv: r.hrvSDNN, rhr: r.restingHR,
            sleepPerformance: sleep, bodyFatPct: latestInBody.pbfPct, steps: r.steps))

        return Scores(bioAge: bioAge, recovery: recovery, strain: strain, sleep: sleep)
    }

    private func persist(_ s: Scores) {
        guard let modelContext else { return }
        let cal = Calendar.current
        let day = cal.startOfDay(for: Date())
        // Predicate-free fetch + in-memory match: the table is one row/day, and SwiftData
        // `#Predicate` equality on Date traps at runtime, so we filter in Swift.
        let all: [DailyScore]
        do { all = try modelContext.fetch(FetchDescriptor<DailyScore>()) }
        catch {
            log.error("DailyScore fetch failed in persist: \(error)")
            all = []
        }
        let record = all.first { cal.isDate($0.day, inSameDayAs: day) } ?? {
            let d = DailyScore(day: day); modelContext.insert(d); return d
        }()
        if let v = s.bioAge?.years { record.bioAgeYears = v }
        if let v = s.recovery { record.recovery = v }
        if let v = s.strain { record.strain = v }
        if let v = s.sleep { record.sleep = v }
        do { try modelContext.save() }
        catch { log.error("DailyScore save failed: \(error)") }
    }

    private func loadHistory() -> [DailyScore] {
        guard let modelContext else { return [] }
        let cutoff = Calendar.current.date(byAdding: .day, value: -180, to: Date()) ?? .distantPast
        do {
            let all = try modelContext.fetch(FetchDescriptor<DailyScore>(sortBy: [SortDescriptor(\.day)]))
            return all.filter { $0.day >= cutoff }
        } catch {
            log.error("DailyScore history fetch failed: \(error)")
            return []
        }
    }

    // MARK: - Mapping (raw → view models)

    private func map(_ r: HealthReadings, scores: Scores = Scores(), history: [DailyScore] = []) {
        let calibrating = r.baselineDays < 7

        // Bio Age (north star) — show once the markers resolve; trend from history.
        if let bio = scores.bioAge {
            let trend = history.compactMap(\.bioAgeYears)
            bioAge = BioAge(years: bio.years, chronological: latestInBody.age,
                            trend: trend.isEmpty ? [bio.years] : trend,
                            deltaYears: bio.deltaYears)
        } else {
            bioAge = nil
        }
        coachAnswers = []

        // Today readout tiles — real scores, or calibrating placeholders.
        let recoveryTrend = history.compactMap(\.recovery).map(Double.init)
        todayTiles = [
            recoveryTile(scores.recovery, trend: recoveryTrend),
            strainTile(scores.strain, recovery: scores.recovery),
            sleepTile(scores.sleep),
        ]

        todayCoachNote = todayNote(scores: scores, calibrating: calibrating)

        // Activity — steps / energy are raw HealthKit values.
        activity = [
            ActivityItem(systemIcon: "figure.walk", title: "Steps",
                         subtitle: r.activeEnergy.map { "\(Int($0)) kcal active" } ?? "No data",
                         value: r.steps.map { Self.int($0) } ?? "—", unit: "/ 10,000", delta: nil),
            ActivityItem(systemIcon: "flame", title: "Calories",
                         subtitle: energySubtitle(r),
                         value: totalEnergy(r), unit: nil, delta: nil),
            ActivityItem(systemIcon: "bolt.fill", title: "HybridCharge",
                         subtitle: "Calibrating", value: "—", unit: "/ 100", delta: nil),
            ActivityItem(systemIcon: "waveform.path.ecg", title: "PAI",
                         subtitle: "Calibrating", value: "—", unit: nil, delta: nil),
        ]

        // Recovery — real 0–100 score (§4b) once baseline exists; inputs always shown.
        let weekRecovery = Array(history.compactMap(\.recovery).suffix(7))
        recovery = RecoveryData(
            todayScore: scores.recovery,
            weekAverage: weekRecovery.isEmpty ? nil : weekRecovery.reduce(0, +) / weekRecovery.count,
            trend: weekRecovery.map(Double.init),
            inputs: recoveryInputs(r, calibrating: calibrating),
            coachNote: calibrating
                ? "Building your baseline — recovery scoring unlocks after ~7 days of data."
                : nil
        )

        // Strain — real 0–21 score (§4c, v1 approximation); target band tracks Recovery.
        let target = Scoring.strainTarget(recovery: scores.recovery)
        strain = StrainData(
            today: scores.strain,
            targetLow: target.low, targetHigh: target.high,
            zones: [],
            sessions: r.workouts.map {
                StrainSession(systemIcon: $0.systemIcon, title: $0.name,
                              subtitle: sessionSubtitle($0), strain: nil, isPlan: false)
            },
            coachNote: nil
        )
    }

    // MARK: - Tile builders

    private func recoveryTile(_ score: Int?, trend: [Double]) -> ScoreTile {
        guard let score else { return calibratingTile("Recovery", drillTo: .recovery) }
        let band = RecoveryBand(score: score)
        let change = recoveryChange(score, trend: trend)
        return ScoreTile(name: "Recovery", value: "\(score)", unit: "%",
                         fill: Double(score) / 100, fillColor: band.color,
                         status: band.label.capitalized, change: change, drillTo: .recovery)
    }

    private func strainTile(_ value: Double?, recovery: Int?) -> ScoreTile {
        guard let value else { return calibratingTile("Strain", drillTo: .strain) }
        let target = Scoring.strainTarget(recovery: recovery)
        return ScoreTile(name: "Strain", value: String(format: "%.1f", value), unit: nil,
                         fill: value / 21, fillColor: Theme.cool,
                         status: "Target \(Int(target.low))–\(Int(target.high))",
                         change: Trend(direction: .flat, text: "—"), drillTo: .strain)
    }

    private func sleepTile(_ score: Int?) -> ScoreTile {
        guard let score else { return calibratingTile("Sleep", drillTo: .recovery) }
        return ScoreTile(name: "Sleep", value: "\(score)", unit: "%",
                         fill: Double(score) / 100, fillColor: Theme.mut, status: "Last night",
                         change: Trend(direction: .flat, text: "—"), drillTo: .recovery)
    }

    private func recoveryChange(_ score: Int, trend: [Double]) -> Trend {
        guard let prev = trend.dropLast().last else { return Trend(direction: .flat, text: "—") }
        let diff = score - Int(prev)
        if diff > 0 { return Trend(direction: .up, text: "▲\(diff)") }
        if diff < 0 { return Trend(direction: .down, text: "▼\(abs(diff))") }
        return Trend(direction: .flat, text: "—")
    }

    private func todayNote(scores: Scores, calibrating: Bool) -> String? {
        guard let recovery = scores.recovery else { return nil }
        let band = RecoveryBand(score: recovery)
        let target = Scoring.strainTarget(recovery: recovery)
        let lead: String
        switch band {
        case .green:  lead = "Recovery is **green at \(recovery)%** — your system is primed for a hard session."
        case .yellow: lead = "Recovery is **moderate at \(recovery)%** — keep effort controlled today."
        case .red:    lead = "Recovery is **low at \(recovery)%** — prioritise rest and easy movement."
        }
        return "\(lead) Strain target **\(Int(target.low))–\(Int(target.high))**."
    }

    private func calibratingTile(_ name: String, drillTo: RootTabView.Tab) -> ScoreTile {
        ScoreTile(name: name, value: "—", unit: nil, fill: 0, fillColor: Theme.txt3,
                  status: "Calibrating", change: Trend(direction: .flat, text: "—"), drillTo: drillTo)
    }

    private func recoveryInputs(_ r: HealthReadings, calibrating: Bool) -> [RecoveryInput] {
        func base(_ v: Double?, _ unit: String) -> String {
            v.map { String(format: "%.0f \(unit)", $0) } ?? "calibrating"
        }
        return [
            RecoveryInput(name: "Heart Rate Variability",
                          detail: "Baseline \(base(r.hrvBaseline, "ms")) · weighted 40%",
                          value: r.hrvSDNN.map { String(format: "%.0f ms", $0) } ?? "—",
                          deltaText: nil, unit: nil),
            RecoveryInput(name: "Resting Heart Rate",
                          detail: "Baseline \(base(r.rhrBaseline, "")) · weighted 25%",
                          value: r.restingHR.map { String(format: "%.0f bpm", $0) } ?? "—",
                          deltaText: nil, unit: nil),
            RecoveryInput(name: "Respiratory Rate", detail: "Weighted 15%",
                          value: r.respiratoryRate.map { String(format: "%.1f", $0) } ?? "—", unit: "rpm"),
            RecoveryInput(name: "Sleep Performance", detail: "Weighted 15%",
                          value: r.asleepSeconds.map { Self.hhmm($0) } ?? "—", deltaText: nil, unit: nil),
            RecoveryInput(name: "Skin Temp / SpO₂", detail: "Weighted 5%",
                          value: r.wristTempDelta.map { String(format: "%+.1f°", $0) } ?? "—",
                          deltaText: nil,
                          unit: r.oxygenSaturation.map { String(format: "%.0f%% O₂", $0 * 100) }),
        ]
    }

    private func energySubtitle(_ r: HealthReadings) -> String {
        let a = r.activeEnergy.map { "\(Int($0)) active" }
        let b = r.basalEnergy.map { "\(Int($0)) rest" }
        return [a, b].compactMap { $0 }.joined(separator: " · ").isEmpty
            ? "No data" : [a, b].compactMap { $0 }.joined(separator: " · ")
    }
    private func totalEnergy(_ r: HealthReadings) -> String {
        let total = (r.activeEnergy ?? 0) + (r.basalEnergy ?? 0)
        return total > 0 ? Self.int(total) : "—"
    }
    private func sessionSubtitle(_ w: WorkoutReading) -> String {
        var parts: [String] = []
        if let km = w.distanceKm { parts.append(String(format: "%.1f km", km)) }
        parts.append("\(w.durationMin) min")
        if let hr = w.averageHR { parts.append("avg \(Int(hr)) bpm") }
        return parts.joined(separator: " · ")
    }

    private static func int(_ v: Double) -> String {
        let f = NumberFormatter(); f.numberStyle = .decimal; f.maximumFractionDigits = 0
        return f.string(from: NSNumber(value: v)) ?? "\(Int(v))"
    }
    private static func hhmm(_ seconds: Double) -> String {
        let h = Int(seconds) / 3600, m = (Int(seconds) % 3600) / 60
        return "\(h)h \(String(format: "%02dm", m))"
    }

    // MARK: - Factories

    /// Live store backed by HealthKit (used by the running app), with on-device
    /// SwiftData persistence for daily scores. Falls back to no persistence if the
    /// store can't be opened (scores still compute; trends just won't accumulate).
    static func live() -> HealthStore {
        let context: ModelContext?
        do { context = try ModelContainer(for: DailyScore.self).mainContext }
        catch {
            log.error("ModelContainer init failed — running without persistence: \(error)")
            context = nil
        }
        return HealthStore(reader: HealthKitReader(), context: context)
    }

    /// Preview store in the authorized-but-no-data state (the simulator / first-launch
    /// case): every derived score shows "calibrating".
    static func calibratingDemo() -> HealthStore {
        let s = HealthStore(reader: EmptyHealthReader())
        s.map(HealthReadings())
        s.phase = .ready
        return s
    }

    /// Preview/demo store pre-filled with the designed view models so SwiftUI previews
    /// always show the full UI without a device.
    static func demo() -> HealthStore {
        let s = HealthStore(reader: PreviewHealthReader())
        s.phase = .ready
        s.bioAge = DemoData.bioAge
        s.todayTiles = DemoData.todayTiles
        s.todayCoachNote = DemoData.todayCoachNote
        s.activity = DemoData.activity
        s.recovery = DemoData.recovery
        s.strain = DemoData.strain
        s.coachAnswers = DemoData.coachAnswers
        s.lastSynced = Date()
        return s
    }
}
