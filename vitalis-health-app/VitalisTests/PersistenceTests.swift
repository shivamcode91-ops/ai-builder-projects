import XCTest
import SwiftData
@testable import Vitalis

/// Guards the SwiftData persistence path that previously trapped on a `#Predicate`
/// Date equality. Uses an in-memory store; asserts a predicate-free fetch round-trips.
final class PersistenceTests: XCTestCase {

    @MainActor
    func testDailyScoreRoundTripWithoutPredicate() throws {
        let container = try ModelContainer(
            for: DailyScore.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        let context = container.mainContext

        let day = Calendar.current.startOfDay(for: Date())
        context.insert(DailyScore(day: day, bioAgeYears: 21.8, recovery: 85, strain: 12.4, sleep: 89))
        try context.save()

        let all = try context.fetch(FetchDescriptor<DailyScore>())
        XCTAssertEqual(all.count, 1)
        let match = all.first { Calendar.current.isDate($0.day, inSameDayAs: day) }
        XCTAssertEqual(match?.recovery, 85)
        XCTAssertEqual(match?.bioAgeYears, 21.8)
    }
}
