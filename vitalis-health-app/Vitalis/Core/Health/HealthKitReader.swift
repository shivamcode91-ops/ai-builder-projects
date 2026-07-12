import Foundation
import HealthKit

/// Real HealthKit-backed reader. Read-only; writes nothing back in v1 (§2b).
/// HealthKit returns no data in the simulator — on-device verification required.
final class HealthKitReader: HealthReading {
    private let store = HKHealthStore()

    // §2b read types. Optional initializers guard against unavailable identifiers.
    private var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>()
        let quantities: [HKQuantityTypeIdentifier] = [
            .restingHeartRate, .heartRateVariabilitySDNN, .heartRate, .respiratoryRate,
            .oxygenSaturation, .appleSleepingWristTemperature, .vo2Max,
            .stepCount, .activeEnergyBurned, .basalEnergyBurned,
            .bodyMass, .bodyFatPercentage, .leanBodyMass,
        ]
        for id in quantities { if let t = HKQuantityType.quantityType(forIdentifier: id) { types.insert(t) } }
        if let sleep = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
        types.insert(HKObjectType.workoutType())
        return types
    }

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    func authorizationState() async -> HealthAuthState {
        guard isAvailable else { return .unavailable }
        // For read-only access, `authorizationStatus(for:)` is useless — it reports
        // *share/write* permission, so read types always look `.sharingDenied`.
        // `getRequestStatusForAuthorization` is the only API that tells us whether a
        // prompt is still needed, without revealing whether reads were granted.
        let status: HKAuthorizationRequestStatus = await withCheckedContinuation { cont in
            store.getRequestStatusForAuthorization(toShare: [], read: readTypes) { status, _ in
                cont.resume(returning: status)
            }
        }
        switch status {
        case .shouldRequest: return .notDetermined   // never asked → show the sheet
        case .unnecessary:   return .authorized       // already asked → just fetch
        case .unknown:       return .notDetermined
        @unknown default:    return .notDetermined
        }
    }

    func requestAuthorization() async -> HealthAuthState {
        guard isAvailable else { return .unavailable }
        do {
            try await store.requestAuthorization(toShare: [], read: readTypes)
            // The sheet has now been shown; reads are opaque, so report authorized and
            // let the fetch decide (empty result → calibrating).
            return .authorized
        } catch {
            return .denied
        }
    }

    // MARK: - Fetch

    func fetchReadings() async throws -> HealthReadings {
        let cal = Calendar.current
        let now = Date()
        let startOfDay = cal.startOfDay(for: now)
        let baselineStart = cal.date(byAdding: .day, value: -30, to: startOfDay) ?? startOfDay

        var r = HealthReadings()

        // Today's latest / daily values
        r.hrvSDNN = try? await latest(.heartRateVariabilitySDNN, unit: HKUnit.secondUnit(with: .milli), since: startOfDay)
        r.restingHR = try? await latest(.restingHeartRate, unit: HKUnit.count().unitDivided(by: .minute()), since: startOfDay)
        r.respiratoryRate = try? await latest(.respiratoryRate, unit: HKUnit.count().unitDivided(by: .minute()), since: startOfDay)
        r.oxygenSaturation = try? await latest(.oxygenSaturation, unit: .percent(), since: startOfDay)
        r.wristTempDelta = try? await latest(.appleSleepingWristTemperature, unit: .degreeCelsius(), since: baselineStart)
        r.vo2Max = try? await latest(.vo2Max, unit: HKUnit(from: "ml/kg*min"), since: baselineStart)
        r.bodyMass = try? await latest(.bodyMass, unit: .gramUnit(with: .kilo), since: baselineStart)
        r.bodyFatPercentage = try? await latest(.bodyFatPercentage, unit: .percent(), since: baselineStart)
        r.leanBodyMass = try? await latest(.leanBodyMass, unit: .gramUnit(with: .kilo), since: baselineStart)

        r.steps = try? await sum(.stepCount, unit: .count(), from: startOfDay, to: now)
        r.activeEnergy = try? await sum(.activeEnergyBurned, unit: .kilocalorie(), from: startOfDay, to: now)
        r.basalEnergy = try? await sum(.basalEnergyBurned, unit: .kilocalorie(), from: startOfDay, to: now)

        // 30-day baselines (mean)
        r.hrvBaseline = try? await average(.heartRateVariabilitySDNN, unit: HKUnit.secondUnit(with: .milli), from: baselineStart, to: now)
        r.rhrBaseline = try? await average(.restingHeartRate, unit: HKUnit.count().unitDivided(by: .minute()), from: baselineStart, to: now)
        r.respiratoryBaseline = try? await average(.respiratoryRate, unit: HKUnit.count().unitDivided(by: .minute()), from: baselineStart, to: now)

        // Sleep (last main period) + workouts
        if let sleep = try? await fetchSleep(since: cal.date(byAdding: .hour, value: -36, to: now) ?? baselineStart) {
            r.asleepSeconds = sleep.asleep
            r.inBedSeconds = sleep.inBed
            r.deepSeconds = sleep.deep
            r.remSeconds = sleep.rem
        }
        r.workouts = (try? await fetchWorkouts(from: startOfDay, to: now)) ?? []
        r.baselineDays = (try? await distinctDays(.heartRateVariabilitySDNN, from: baselineStart, to: now)) ?? 0

        return r
    }

    // MARK: - Query helpers

    private func latest(_ id: HKQuantityTypeIdentifier, unit: HKUnit, since: Date) async throws -> Double? {
        guard let type = HKQuantityType.quantityType(forIdentifier: id) else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: since, end: Date(), options: .strictStartDate)
        return try await withCheckedThrowingContinuation { cont in
            let sort = [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]
            let q = HKSampleQuery(sampleType: type, predicate: predicate, limit: 1, sortDescriptors: sort) { _, samples, error in
                if let error { cont.resume(throwing: error); return }
                let value = (samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: unit)
                cont.resume(returning: value)
            }
            store.execute(q)
        }
    }

    private func statistic(_ id: HKQuantityTypeIdentifier, unit: HKUnit, from: Date, to: Date,
                           options: HKStatisticsOptions) async throws -> Double? {
        guard let type = HKQuantityType.quantityType(forIdentifier: id) else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: from, end: to, options: .strictStartDate)
        return try await withCheckedThrowingContinuation { cont in
            let q = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: options) { _, stats, error in
                if let error { cont.resume(throwing: error); return }
                let q = options == .cumulativeSum ? stats?.sumQuantity() : stats?.averageQuantity()
                cont.resume(returning: q?.doubleValue(for: unit))
            }
            store.execute(q)
        }
    }

    private func sum(_ id: HKQuantityTypeIdentifier, unit: HKUnit, from: Date, to: Date) async throws -> Double? {
        try await statistic(id, unit: unit, from: from, to: to, options: .cumulativeSum)
    }
    private func average(_ id: HKQuantityTypeIdentifier, unit: HKUnit, from: Date, to: Date) async throws -> Double? {
        try await statistic(id, unit: unit, from: from, to: to, options: .discreteAverage)
    }

    private func distinctDays(_ id: HKQuantityTypeIdentifier, from: Date, to: Date) async throws -> Int {
        guard let type = HKQuantityType.quantityType(forIdentifier: id) else { return 0 }
        let predicate = HKQuery.predicateForSamples(withStart: from, end: to, options: .strictStartDate)
        return try await withCheckedThrowingContinuation { cont in
            let q = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
                if let error { cont.resume(throwing: error); return }
                let cal = Calendar.current
                let days = Set((samples ?? []).map { cal.startOfDay(for: $0.startDate) })
                cont.resume(returning: days.count)
            }
            store.execute(q)
        }
    }

    private struct SleepTotals { var asleep: Double; var inBed: Double; var deep: Double; var rem: Double }

    private func fetchSleep(since: Date) async throws -> SleepTotals? {
        guard let type = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: since, end: Date(), options: [])
        return try await withCheckedThrowingContinuation { cont in
            let q = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
                if let error { cont.resume(throwing: error); return }
                guard let samples = samples as? [HKCategorySample], !samples.isEmpty else {
                    cont.resume(returning: nil); return
                }
                var asleep = 0.0, inBed = 0.0, deep = 0.0, rem = 0.0
                for s in samples {
                    let dur = s.endDate.timeIntervalSince(s.startDate)
                    switch HKCategoryValueSleepAnalysis(rawValue: s.value) {
                    case .inBed: inBed += dur
                    case .asleepDeep: deep += dur; asleep += dur
                    case .asleepREM: rem += dur; asleep += dur
                    case .asleepCore, .asleepUnspecified: asleep += dur
                    default: break
                    }
                }
                cont.resume(returning: SleepTotals(asleep: asleep, inBed: inBed, deep: deep, rem: rem))
            }
            store.execute(q)
        }
    }

    private func fetchWorkouts(from: Date, to: Date) async throws -> [WorkoutReading] {
        let predicate = HKQuery.predicateForSamples(withStart: from, end: to, options: .strictStartDate)
        return try await withCheckedThrowingContinuation { cont in
            let sort = [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            let q = HKSampleQuery(sampleType: .workoutType(), predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: sort) { _, samples, error in
                if let error { cont.resume(throwing: error); return }
                let workouts = (samples as? [HKWorkout] ?? []).map { w -> WorkoutReading in
                    let meters = w.statistics(for: HKQuantityType(.distanceWalkingRunning))?
                        .sumQuantity()?.doubleValue(for: .meter())
                    let km = meters.map { $0 / 1000 }
                    return WorkoutReading(
                        name: w.workoutActivityType.displayName,
                        systemIcon: w.workoutActivityType.symbolName,
                        distanceKm: km,
                        durationMin: Int(w.duration / 60),
                        averageHR: nil,
                        start: w.startDate
                    )
                }
                cont.resume(returning: workouts)
            }
            store.execute(q)
        }
    }
}

private extension HKWorkoutActivityType {
    var displayName: String {
        switch self {
        case .running: return "Run"
        case .walking: return "Walk"
        case .cycling: return "Cycle"
        case .traditionalStrengthTraining, .functionalStrengthTraining: return "Strength"
        case .highIntensityIntervalTraining: return "HIIT"
        case .swimming: return "Swim"
        default: return "Workout"
        }
    }
    var symbolName: String {
        switch self {
        case .running: return "figure.run"
        case .walking: return "figure.walk"
        case .cycling: return "figure.outdoor.cycle"
        case .traditionalStrengthTraining, .functionalStrengthTraining: return "dumbbell.fill"
        case .swimming: return "figure.pool.swim"
        default: return "bolt.heart"
        }
    }
}
