import XCTest
@testable import Vitalis

/// Pure-function tests for the §4 scoring engine. No HealthKit, no UI.
final class ScoringTests: XCTestCase {

    // MARK: Recovery (§4b)

    func testRecoveryHighWhenHRVUpAndRHRDown() {
        let score = Scoring.recovery(.init(
            hrv: 65, hrvBaseline: 50,        // +30% → top of HRV range
            rhr: 46, rhrBaseline: 52,        // below baseline → good
            respiratory: 14, respiratoryBaseline: 14,
            sleepPerformance: 90, wristTempDelta: 0.1, spo2: 0.98))
        XCTAssertNotNil(score)
        XCTAssertGreaterThanOrEqual(score!, 67)   // green band
    }

    func testRecoveryLowWhenHRVCrashes() {
        let score = Scoring.recovery(.init(
            hrv: 32, hrvBaseline: 52,        // ~−38% → suppressed
            rhr: 60, rhrBaseline: 50,        // elevated → bad
            respiratory: 18, respiratoryBaseline: 14,
            sleepPerformance: 40, wristTempDelta: 0.8, spo2: 0.95))
        XCTAssertNotNil(score)
        XCTAssertLessThan(score!, 50)
    }

    func testRecoveryNilWithoutHeartInputs() {
        let score = Scoring.recovery(.init(
            hrv: nil, hrvBaseline: nil, rhr: nil, rhrBaseline: nil,
            respiratory: 14, respiratoryBaseline: 14,
            sleepPerformance: 80, wristTempDelta: nil, spo2: nil))
        XCTAssertNil(score)
    }

    // MARK: Sleep (§4d)

    func testSleepPerformanceFullNightScoresHigh() {
        let score = Scoring.sleepPerformance(.init(
            asleepSeconds: 8 * 3600, inBedSeconds: 8.5 * 3600,
            deepSeconds: 5400, remSeconds: 6300, needSeconds: 8 * 3600))
        XCTAssertNotNil(score)
        XCTAssertGreaterThan(score!, 80)
    }

    func testSleepPerformanceShortNightScoresLower() {
        let full = Scoring.sleepPerformance(.init(
            asleepSeconds: 8 * 3600, inBedSeconds: 8.5 * 3600,
            deepSeconds: 5400, remSeconds: 6300, needSeconds: 8 * 3600))!
        let short = Scoring.sleepPerformance(.init(
            asleepSeconds: 4 * 3600, inBedSeconds: 5 * 3600,
            deepSeconds: 2000, remSeconds: 2000, needSeconds: 8 * 3600))!
        XCTAssertLessThan(short, full)
    }

    func testSleepNilWhenNoData() {
        XCTAssertNil(Scoring.sleepPerformance(.init(
            asleepSeconds: nil, inBedSeconds: nil,
            deepSeconds: nil, remSeconds: nil, needSeconds: 8 * 3600)))
    }

    // MARK: Strain (§4c)

    func testStrainInRangeAndMonotonic() {
        let light = Scoring.strain(.init(activeEnergy: 200, workoutMinutes: 0, bmr: 1300, recoveryScore: 70))!
        let heavy = Scoring.strain(.init(activeEnergy: 1200, workoutMinutes: 90, bmr: 1300, recoveryScore: 70))!
        XCTAssertGreaterThan(heavy, light)
        for v in [light, heavy] { XCTAssertTrue((0...21).contains(v)) }
    }

    func testStrainNilWithoutLoad() {
        XCTAssertNil(Scoring.strain(.init(activeEnergy: nil, workoutMinutes: 0, bmr: 1300, recoveryScore: nil)))
    }

    func testStrainTargetTracksRecovery() {
        XCTAssertGreaterThan(Scoring.strainTarget(recovery: 80).high,
                             Scoring.strainTarget(recovery: 20).high)
    }

    // MARK: Biological Age (§4a)

    func testBioAgeYoungerWithStrongMarkers() {
        let result = Scoring.biologicalAge(.init(
            chronologicalAge: 24, sex: .male,
            vo2max: 52, hrv: 70, rhr: 48,
            sleepPerformance: 90, bodyFatPct: 14, steps: 10_000))
        XCTAssertNotNil(result)
        XCTAssertLessThan(result!.years, 24)        // younger than chronological
        XCTAssertLessThan(result!.deltaYears, 0)
    }

    func testBioAgeOlderWithPoorMarkers() {
        let result = Scoring.biologicalAge(.init(
            chronologicalAge: 24, sex: .male,
            vo2max: 28, hrv: 22, rhr: 80,
            sleepPerformance: 40, bodyFatPct: 30, steps: 1_000))!
        XCTAssertGreaterThan(result.years, 24)
    }

    func testBioAgeClampedTo15Years() {
        let result = Scoring.biologicalAge(.init(
            chronologicalAge: 40, sex: .male,
            vo2max: 90, hrv: 200, rhr: 35,
            sleepPerformance: 100, bodyFatPct: 8, steps: 30_000))!
        XCTAssertGreaterThanOrEqual(result.years, 25)   // 40 − 15 floor
    }

    func testBioAgeLowConfidenceWhenVO2Estimated() {
        let result = Scoring.biologicalAge(.init(
            chronologicalAge: 24, sex: .male,
            vo2max: nil, hrv: 60, rhr: 50,
            sleepPerformance: 85, bodyFatPct: 17, steps: 8_000))!
        XCTAssertTrue(result.lowConfidence)
    }

    func testBioAgeNilWithoutCoreMarkers() {
        XCTAssertNil(Scoring.biologicalAge(.init(
            chronologicalAge: 24, sex: .male,
            vo2max: nil, hrv: nil, rhr: nil,
            sleepPerformance: 80, bodyFatPct: 17, steps: 8_000)))
    }

    // MARK: Norms

    func testVO2SubscoreMonotonic() {
        let lo = Norms.vo2maxSubscore(33, age: 24, sex: .male)
        let hi = Norms.vo2maxSubscore(56, age: 24, sex: .male)
        XCTAssertLessThan(lo, hi)
        XCTAssertTrue((0...100).contains(lo))
        XCTAssertTrue((0...100).contains(hi))
    }

    func testRHRSubscoreInverted() {
        // Lower resting HR should score higher.
        XCTAssertGreaterThan(Norms.rhrSubscore(48, age: 24, sex: .male),
                             Norms.rhrSubscore(78, age: 24, sex: .male))
    }
}
