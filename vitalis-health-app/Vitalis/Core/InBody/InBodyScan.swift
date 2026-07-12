import Foundation

/// One dated InBody record (InBody 260 layout). §5.
struct InBodyScan: Identifiable, Hashable {
    let id = UUID()

    // profile
    var heightCm: Double
    var age: Int
    var sex: String
    var testDate: Date
    var score: Int

    // core
    var weightKg: Double
    var smmKg: Double               // skeletal muscle mass
    var bodyFatMassKg: Double
    var pbfPct: Double
    var bmi: Double

    // composition
    var totalBodyWaterL: Double
    var proteinKg: Double
    var mineralKg: Double
    var ffmKg: Double               // fat-free mass

    // metabolic
    var bmrKcal: Int
    var recommendedIntakeKcal: Int
    var visceralFatLevel: Int
    var waistHipRatio: Double
    var smi: Double

    // segmental lean (kg)
    var segLean: Segmental
    var segFat: Segmental

    // targets
    var targetWeightKg: Double
    var weightControlKg: Double
    var fatControlKg: Double
    var muscleControlKg: Double

    struct Segmental: Hashable {
        var armL: Double
        var armR: Double
        var trunk: Double
        var legL: Double
        var legR: Double
    }

    /// Printed normal ranges used for the "below/above range" flags (§5).
    struct Range { var low: Double; var high: Double }
    static let proteinRange = Range(low: 8.7, high: 10.7)
    static let mineralRange  = Range(low: 3.0, high: 3.67)
    static let tbwRange      = Range(low: 32.5, high: 39.7)

    var proteinBelowRange: Bool { proteinKg < Self.proteinRange.low }
}

extension InBodyScan {
    /// The user's real Jun 3 2026 scan — seed data for dev/testing. §5.
    static let seedJun2026 = InBodyScan(
        heightCm: 162, age: 24, sex: "M",
        testDate: DateComponents(calendar: .current, year: 2026, month: 6, day: 3, hour: 22, minute: 5).date ?? .now,
        score: 73,
        weightKg: 51.7, smmKg: 23.5, bodyFatMassKg: 9.0, pbfPct: 17.3, bmi: 19.7,
        totalBodyWaterL: 31.4, proteinKg: 8.5, mineralKg: 2.81, ffmKg: 42.7,
        bmrKcal: 1293, recommendedIntakeKcal: 2567, visceralFatLevel: 3,
        waistHipRatio: 0.84, smi: 6.5,
        segLean: .init(armL: 2.15, armR: 2.18, trunk: 19.1, legL: 6.36, legR: 6.33),
        segFat:  .init(armL: 0.5, armR: 0.5, trunk: 4.0, legL: 1.5, legR: 1.5),
        targetWeightKg: 57.7, weightControlKg: 6.0, fatControlKg: -0.3, muscleControlKg: 6.3
    )
}
