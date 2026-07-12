import SwiftUI

// MARK: - Shared value types

/// A single labelled data point with an optional delta and trend direction.
struct Trend: Hashable {
    enum Direction { case up, down, flat }
    var direction: Direction
    var text: String                 // e.g. "▲11%", "top 5%", "—"

    var color: Color {
        switch direction {
        case .up: return Theme.good
        case .down: return Theme.good   // a *lower* RHR is good; callers set semantics
        case .flat: return Theme.txt3
        }
    }
}

/// Recovery band (Whoop-style), §4b.
enum RecoveryBand {
    case green, yellow, red
    init(score: Int) {
        switch score {
        case 67...: self = .green
        case 34...66: self = .yellow
        default: self = .red
        }
    }
    var color: Color {
        switch self {
        case .green: return Theme.good
        case .yellow: return Theme.warn
        case .red: return Theme.accent
        }
    }
    var label: String {
        switch self {
        case .green: return "green"
        case .yellow: return "yellow"
        case .red: return "red"
        }
    }
}

// MARK: - North star

struct BioAge {
    var years: Double               // 21.8
    var chronological: Int          // 24
    var trend: [Double]             // sparkline series
    var deltaYears: Double          // +/- vs chronological (negative = younger)

    var deltaLabel: String {
        let mag = abs(deltaYears)
        return String(format: "%.1f yrs %@", mag, deltaYears <= 0 ? "younger" : "older")
    }
}

// MARK: - Today tiles

struct ScoreTile: Identifiable {
    let id = UUID()
    var name: String
    var value: String               // "85", "12.4"
    var unit: String?               // "%", nil
    var fill: Double                // 0...1 meter
    var fillColor: Color
    var status: String              // "Primed", "Target 14–16"
    var change: Trend
    var drillTo: RootTabView.Tab?
}

struct ActivityItem: Identifiable {
    let id = UUID()
    var systemIcon: String
    var title: String
    var subtitle: String
    var value: String
    var unit: String?               // "/ 10,000"
    var delta: String?              // "▲ 7d"
}

// MARK: - Recovery

struct RecoveryInput: Identifiable {
    let id = UUID()
    var name: String
    var detail: String              // "Baseline 52 ms · weighted 40%"
    var value: String               // "58 ms"
    var deltaText: String?          // "▲ 11%"
    var unit: String?
}

struct RecoveryData {
    var todayScore: Int?            // nil = calibrating (scoring is Phase 3)
    var weekAverage: Int?
    var trend: [Double]
    var inputs: [RecoveryInput]
    var coachNote: String?
    var band: RecoveryBand? { todayScore.map { RecoveryBand(score: $0) } }
}

// MARK: - Strain

struct HRZone: Identifiable {
    let id = UUID()
    var name: String                // "Z5"
    var fill: Double                // 0...1
    var color: Color
    var minutes: String             // "4m"
}

struct StrainSession: Identifiable {
    let id = UUID()
    var systemIcon: String
    var title: String
    var subtitle: String
    var strain: String?             // "9.1" or nil for a planned item
    var isPlan: Bool = false
}

struct StrainData {
    var today: Double?              // nil = calibrating (scoring is Phase 3)
    var targetLow: Double
    var targetHigh: Double
    var zones: [HRZone]
    var sessions: [StrainSession]
    var coachNote: String?
}

// MARK: - Coach

struct CoachAnswer: Identifiable {
    let id = UUID()
    var question: String
    var answer: AttributedString
    var sources: [String]           // "recovery · today"
}
