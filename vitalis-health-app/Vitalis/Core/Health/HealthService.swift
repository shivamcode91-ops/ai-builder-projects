import Foundation

/// Authorization state for the Health connection, independent of HealthKit types
/// so previews/mocks don't need to import HealthKit.
enum HealthAuthState {
    case unavailable        // device has no Health data (e.g. iPad / not provisioned)
    case notDetermined      // never asked — we should present the request sheet
    case authorized         // request has already been made; proceed to fetch
    case denied             // device-level Health unavailable / request errored
}

/// The data-source boundary. Phase 2 ships two conformers: `HealthKitReader` (real)
/// and `PreviewHealthReader` (canned). The UI never touches this directly — it talks
/// to `HealthStore`, which maps readings into view models.
protocol HealthReading {
    var isAvailable: Bool { get }
    func authorizationState() async -> HealthAuthState
    /// Requests read access for the §2b types. Returns the resulting state.
    func requestAuthorization() async -> HealthAuthState
    /// One sync pass: today's values + 30-day baselines + recent workouts.
    func fetchReadings() async throws -> HealthReadings
}
