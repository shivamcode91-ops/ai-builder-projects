import SwiftUI

/// Fully-formed view models matching vitalis3.html. Used to populate `HealthStore.demo`
/// for SwiftUI previews so the designed UI is always visible without a device.
/// The live app does NOT use these — it maps real HealthKit readings instead.
enum DemoData {

    static let bioAge = BioAge(
        years: 21.8, chronological: 24,
        trend: [10, 13, 11, 18, 21, 26, 30, 33], deltaYears: -2.2
    )

    static let todayTiles: [ScoreTile] = [
        ScoreTile(name: "Recovery", value: "85", unit: "%", fill: 0.85,
                  fillColor: Theme.good, status: "Primed",
                  change: Trend(direction: .up, text: "▲6"), drillTo: .recovery),
        ScoreTile(name: "Strain", value: "12.4", unit: nil, fill: 0.59,
                  fillColor: Theme.cool, status: "Target 14–16",
                  change: Trend(direction: .flat, text: "—"), drillTo: .strain),
        ScoreTile(name: "Sleep", value: "89", unit: "%", fill: 0.89,
                  fillColor: Theme.mut, status: "8h 06m",
                  change: Trend(direction: .up, text: "▲4"), drillTo: .recovery),
    ]

    static let todayCoachNote =
        "HRV is **11% above baseline** and recovery is green. Good day for a hard session — and your InBody plan wants **+6kg muscle**, so make it strength. Protein is your gap: target **~110g**."

    static let activity: [ActivityItem] = [
        ActivityItem(systemIcon: "figure.walk", title: "Steps", subtitle: "3.1 km active",
                     value: "8,420", unit: "/ 10,000", delta: nil),
        ActivityItem(systemIcon: "flame", title: "Calories", subtitle: "680 active · 1,500 rest",
                     value: "2,180", unit: "/ 2,567", delta: nil),
        ActivityItem(systemIcon: "bolt.fill", title: "HybridCharge", subtitle: "Energy reserve good",
                     value: "72", unit: "/ 100", delta: nil),
        ActivityItem(systemIcon: "waveform.path.ecg", title: "PAI", subtitle: "Above 100 — optimal",
                     value: "118", unit: nil, delta: "▲ 7d"),
    ]

    static let recovery = RecoveryData(
        todayScore: 85, weekAverage: 79,
        trend: [30, 22, 38, 18, 28, 20, 12].map { 56 - $0 },
        inputs: [
            RecoveryInput(name: "Heart Rate Variability", detail: "Baseline 52 ms · weighted 40%",
                          value: "58 ms", deltaText: "▲ 11%", unit: nil),
            RecoveryInput(name: "Resting Heart Rate", detail: "Baseline 50 · weighted 25%",
                          value: "48 bpm", deltaText: "▼ 2", unit: nil),
            RecoveryInput(name: "Respiratory Rate", detail: "Normal · weighted 15%",
                          value: "14.2", deltaText: nil, unit: "rpm"),
            RecoveryInput(name: "Sleep Performance", detail: "Weighted 15%",
                          value: "89%", deltaText: "▲ 6", unit: nil),
            RecoveryInput(name: "Skin Temp / SpO₂", detail: "Weighted 5%",
                          value: "+0.2°", deltaText: nil, unit: "98% O₂"),
        ],
        coachNote: "Three straight green days. Your weekly recovery average is climbing — autonomic balance trending younger. Today supports high strain; just protect the 10:30p sleep window."
    )

    static let strain = StrainData(
        today: 12.4, targetLow: 14.0, targetHigh: 16.0,
        zones: [
            HRZone(name: "Z5", fill: 0.08, color: Theme.accent, minutes: "4m"),
            HRZone(name: "Z4", fill: 0.22, color: Theme.warn, minutes: "14m"),
            HRZone(name: "Z3", fill: 0.46, color: Theme.good, minutes: "31m"),
            HRZone(name: "Z2", fill: 0.70, color: Theme.cool, minutes: "52m"),
            HRZone(name: "Z1", fill: 0.34, color: Theme.mut, minutes: "23m"),
        ],
        sessions: [
            StrainSession(systemIcon: "figure.run", title: "Morning Run",
                          subtitle: "6.2 km · 42 min · avg 158 bpm", strain: "9.1"),
            StrainSession(systemIcon: "dumbbell.fill", title: "Strength — Push",
                          subtitle: "Auto · 18 sets · 38 min", strain: "4.8"),
            StrainSession(systemIcon: "flag.checkered", title: "HYROX Sim",
                          subtitle: "Race mode · 8 stations · 5:00p", strain: nil, isPlan: true),
        ],
        coachNote: "You've spent most of today in Z2 — ideal for the aerobic base that holds your VO₂max. To hit the 14–16 target, the planned HYROX sim will add roughly **+3.5 strain**."
    )

    static var coachAnswers: [CoachAnswer] {
        [
            CoachAnswer(
                question: "What should I focus on?",
                answer: md("Recovery is green at **85%** and HRV is up. But your InBody scan is the bigger story: you're lean (17.3% fat) and the plan calls for **+6kg of muscle** — the main lever on both strength and long-term biological age."),
                sources: ["recovery · today", "inbody · jun 3", "hrv · 14d"]
            ),
            CoachAnswer(
                question: "Why is my protein flagged?",
                answer: md("Your InBody protein reads **8.5 kg** against a 8.7–10.7 kg range — slightly low for your frame. Combined with the muscle-gain target, aim **~110 g/day** (≈2.1 g/kg) and a small calorie surplus."),
                sources: ["inbody · protein", "bmr · 1293"]
            ),
        ]
    }

    static let coachPrompts = [
        "How is my biological age computed?",
        "Build a strength + surplus plan",
        "Compare to my last InBody scan",
        "How did my sleep trend this month?",
    ]

    private static func md(_ s: String) -> AttributedString {
        (try? AttributedString(markdown: s)) ?? AttributedString(s)
    }
}

/// Authorized reader that returns no data — the first-launch / simulator case where every
/// derived score must show "calibrating".
struct EmptyHealthReader: HealthReading {
    var isAvailable: Bool { true }
    func authorizationState() async -> HealthAuthState { .authorized }
    func requestAuthorization() async -> HealthAuthState { .authorized }
    func fetchReadings() async throws -> HealthReadings { HealthReadings() }
}

/// A `HealthReading` that returns canned raw readings and reports authorized.
/// Lets previews exercise the live readings→view-model mapping path off-device.
struct PreviewHealthReader: HealthReading {
    var isAvailable: Bool { true }
    func authorizationState() async -> HealthAuthState { .authorized }
    func requestAuthorization() async -> HealthAuthState { .authorized }
    func fetchReadings() async throws -> HealthReadings {
        HealthReadings(
            hrvSDNN: 58, restingHR: 48, respiratoryRate: 14.2, oxygenSaturation: 0.98,
            wristTempDelta: 0.2, vo2Max: 47, steps: 8420, activeEnergy: 680, basalEnergy: 1500,
            bodyMass: 51.7, bodyFatPercentage: 0.173, leanBodyMass: 42.7,
            asleepSeconds: 8 * 3600 + 6 * 60, inBedSeconds: 8.5 * 3600,
            deepSeconds: 5400, remSeconds: 6300,
            hrvBaseline: 52, rhrBaseline: 50, respiratoryBaseline: 14.0,
            sleepDurationBaseline: 7.5 * 3600,
            workouts: [
                WorkoutReading(name: "Morning Run", systemIcon: "figure.run",
                               distanceKm: 6.2, durationMin: 42, averageHR: 158, start: .now)
            ],
            baselineDays: 30
        )
    }
}
