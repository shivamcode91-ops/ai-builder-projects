import Foundation
import SwiftData

/// One day's computed scores, persisted on-device (§9 Phase 3). Powers the trend
/// sparklines (Bio Age 6-month, Recovery week) without recomputing history.
@Model
final class DailyScore {
    /// Start-of-day. One row per calendar day — `HealthStore` upserts by matching day.
    var day: Date
    var bioAgeYears: Double?
    var recovery: Int?
    var strain: Double?
    var sleep: Int?

    init(day: Date, bioAgeYears: Double? = nil, recovery: Int? = nil,
         strain: Double? = nil, sleep: Int? = nil) {
        self.day = day
        self.bioAgeYears = bioAgeYears
        self.recovery = recovery
        self.strain = strain
        self.sleep = sleep
    }
}
