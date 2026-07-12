import SwiftUI

@main
struct VitalisApp: App {
    @State private var store = HealthStore.live()
    @State private var wasBackgrounded = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootTabView(store: store)
                .preferredColorScheme(.dark)
                .task { await store.start() }
                .onChange(of: scenePhase) { _, phase in
                    // Launch goes inactive→active and would double the `.task` start,
                    // so only re-sync after a genuine trip through the background.
                    if phase == .background { wasBackgrounded = true }
                    if phase == .active && wasBackgrounded {
                        wasBackgrounded = false
                        Task { await store.start() }
                    }
                }
        }
    }
}

struct RootTabView: View {
    @Bindable var store: HealthStore
    @State private var selection: Tab = .today
    @Environment(\.openURL) private var openURL

    enum Tab: Hashable { case today, recovery, strain, body, coach }

    var body: some View {
        Group {
            switch store.phase {
            case .needsAuthorization, .denied, .unavailable:
                HealthAuthView(phase: store.phase, onConnect: connect)
            case .loading where store.lastSynced == nil:
                loading
            default:
                tabs
            }
        }
        .tint(Theme.accent)
        .background(Theme.bg.ignoresSafeArea())
    }

    private var tabs: some View {
        TabView(selection: $selection) {
            TodayView(store: store, onDrill: { selection = $0 })
                .tabItem { Label("Today", systemImage: "square.grid.2x2") }
                .tag(Tab.today)

            RecoveryView(store: store)
                .tabItem { Label("Recovery", systemImage: "waveform.path.ecg") }
                .tag(Tab.recovery)

            StrainView(store: store)
                .tabItem { Label("Strain", systemImage: "chart.bar.fill") }
                .tag(Tab.strain)

            BodyView(store: store)
                .tabItem { Label("Body", systemImage: "figure.stand") }
                .tag(Tab.body)

            CoachView(store: store)
                .tabItem { Label("Coach", systemImage: "bubble.left.fill") }
                .tag(Tab.coach)
        }
    }

    private var loading: some View {
        VStack(spacing: 14) {
            ProgressView().tint(Theme.accent)
            Text("Syncing your Health data…").font(Typeface.mono(12)).foregroundStyle(Theme.txt3)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.bg)
    }

    private func connect() {
        if store.phase == .denied {
            if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
        } else {
            Task { await store.connect() }
        }
    }
}

#Preview {
    RootTabView(store: .demo()).preferredColorScheme(.dark)
}
