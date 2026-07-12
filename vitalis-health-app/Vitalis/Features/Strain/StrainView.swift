import SwiftUI

struct StrainView: View {
    @Bindable var store: HealthStore
    @State private var period = "1D"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScreenHeader(title: "Strain", subtitle: "CARDIO LOAD · 0–21")
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 8)

                PeriodToggle(selection: $period)
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 10)

                hero.padding(.horizontal, Metrics.screenPad).padding(.top, 14)

                if let zones = store.strain?.zones, !zones.isEmpty {
                    SectionLabel(title: "Heart-Rate Zones", trailing: "today", trailingColor: Theme.txt3)
                        .padding(.horizontal, Metrics.screenPad).padding(.top, 20)
                    VStack(spacing: 0) {
                        ForEach(zones) { zone in
                            HStack(spacing: 10) {
                                Text(zone.name).font(Typeface.mono(10)).foregroundStyle(Theme.txt3).frame(width: 24, alignment: .leading)
                                GeometryReader { geo in
                                    ZStack(alignment: .leading) {
                                        Capsule().fill(Theme.surface2)
                                        Capsule().fill(zone.color).frame(width: max(4, geo.size.width * zone.fill))
                                    }
                                }
                                .frame(height: 7)
                                Text(zone.minutes).font(Typeface.mono(11)).foregroundStyle(Theme.txt2).frame(width: 42, alignment: .trailing)
                            }
                            .padding(.vertical, 7)
                        }
                    }
                    .card()
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 12)
                }

                SectionLabel(title: "Sessions", trailing: "+ Add")
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 20)

                if let sessions = store.strain?.sessions, !sessions.isEmpty {
                    RowCard {
                        ForEach(Array(sessions.enumerated()), id: \.element.id) { idx, session in
                            MetricRow(systemIcon: session.systemIcon, title: session.title, subtitle: session.subtitle,
                                      value: session.strain ?? (session.isPlan ? "plan" : "—"),
                                      unit: session.isPlan || session.strain == nil ? nil : "strain")
                            if idx < sessions.count - 1 { RowDivider() }
                        }
                    }
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 12)
                } else {
                    CalibratingCard(title: "No sessions yet",
                                    message: "Workouts from Apple Health will appear here.",
                                    systemIcon: "figure.run")
                        .padding(.horizontal, Metrics.screenPad).padding(.top, 12)
                }

                if let note = store.strain?.coachNote {
                    CoachNote(text: note)
                        .padding(.horizontal, Metrics.screenPad).padding(.top, 16)
                }

                FooterNote(text: "")
            }
        }
        .background(Theme.bg)
        .refreshable { await store.refresh() }
    }

    @ViewBuilder private var hero: some View {
        let s = store.strain
        HeroCard {
            VStack(spacing: 0) {
                Text("Accumulated Today").monoLabel(color: Theme.accent)
                if let today = s?.today {
                    Text(String(format: "%.1f", today))
                        .font(Typeface.serif(80)).foregroundStyle(Theme.txt).padding(.top, 8)
                    StatusTag(text: String(format: "Target %.1f – %.1f", s?.targetLow ?? 0, s?.targetHigh ?? 0),
                              fg: Theme.cool, fill: Theme.coolFill, stroke: Theme.coolLine)
                        .padding(.top, 10)
                } else {
                    Text("—").font(Typeface.serif(80)).foregroundStyle(Theme.txt3).padding(.top, 8)
                    Text("No strain yet — it builds as today's activity syncs from Apple Health.")
                        .font(Typeface.sans(12)).foregroundStyle(Theme.txt3).padding(.top, 6)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }
}

#Preview {
    StrainView(store: .demo()).preferredColorScheme(.dark)
}
