import Foundation

/// Raw values pulled from HealthKit for one sync pass. Everything is optional —
/// a missing metric must surface an empty/"calibrating" state, never a fake number (§10).
struct HealthReadings {
    // Today (00:00 → now)
    var hrvSDNN: Double?            // ms
    var restingHR: Double?          // bpm
    var respiratoryRate: Double?    // rpm
    var oxygenSaturation: Double?   // 0...1
    var wristTempDelta: Double?     // °C deviation vs baseline
    var vo2Max: Double?             // mL/kg/min
    var steps: Double?
    var activeEnergy: Double?       // kcal
    var basalEnergy: Double?        // kcal

    // Body (reconciled with InBody when a recent scan exists)
    var bodyMass: Double?           // kg
    var bodyFatPercentage: Double?  // 0...1
    var leanBodyMass: Double?       // kg

    // Sleep (last main sleep period)
    var asleepSeconds: Double?
    var inBedSeconds: Double?
    var deepSeconds: Double?
    var remSeconds: Double?

    // 30-day rolling baselines (mean) for the inputs that need them (§3)
    var hrvBaseline: Double?
    var rhrBaseline: Double?
    var respiratoryBaseline: Double?
    var sleepDurationBaseline: Double?   // seconds

    // Workouts in range → strain sessions
    var workouts: [WorkoutReading] = []

    /// How many days of baseline history exist; <7 ⇒ "calibrating" (§3.6).
    var baselineDays: Int = 0

    var hasAnyData: Bool {
        hrvSDNN != nil || restingHR != nil || steps != nil ||
        asleepSeconds != nil || vo2Max != nil || !workouts.isEmpty
    }
}

struct WorkoutReading: Identifiable {
    let id = UUID()
    var name: String
    var systemIcon: String
    var distanceKm: Double?
    var durationMin: Int
    var averageHR: Double?
    var start: Date
}
