import SwiftUI

struct TodayView: View {
    @Bindable var store: HealthStore
    var onDrill: (RootTabView.Tab) -> Void = { _ in }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScreenHeader(title: "Today", subtitle: subtitle)
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 8)

                hero.padding(.horizontal, Metrics.screenPad).padding(.top, 14)

                SectionLabel(title: "Daily Readouts", trailing: "Detail →")
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 20)

                HStack(spacing: Metrics.gap) {
                    ForEach(store.todayTiles) { tile in
                        ScoreCard(tile: tile) { if let t = tile.drillTo { onDrill(t) } }
                    }
                }
                .padding(.horizontal, Metrics.screenPad).padding(.top, 12)

                if let note = store.todayCoachNote {
                    CoachNote(text: note)
                        .padding(.horizontal, Metrics.screenPad).padding(.top, 16)
                }

                SectionLabel(title: "Activity", trailing: "All →")
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 20)

                RowCard {
                    ForEach(Array(store.activity.enumerated()), id: \.element.id) { idx, a in
                        MetricRow(systemIcon: a.systemIcon, title: a.title, subtitle: a.subtitle,
                                  value: a.value, unit: a.unit, delta: a.delta)
                        if idx < store.activity.count - 1 { RowDivider() }
                    }
                }
                .padding(.horizontal, Metrics.screenPad).padding(.top, 12)

                FooterNote(text: "Apple Health · Helio Strap · InBody 260")
            }
        }
        .background(Theme.bg)
        .refreshable { await store.refresh() }
    }

    private var subtitle: String {
        let d = Date().formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
        if let synced = store.lastSynced {
            let ago = synced.formatted(.relative(presentation: .named))
            return "\(d.uppercased()) · synced \(ago)"
        }
        return d.uppercased()
    }

    @ViewBuilder private var hero: some View {
        HeroCard {
            Text("Biological Age").monoLabel(color: Theme.accent)
            if let b = store.bioAge {
                HStack(alignment: .bottom) {
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(String(format: "%.1f", b.years)).font(Typeface.serif(78))
                        Text("yrs").font(Typeface.sans(24)).foregroundStyle(Theme.txt3)
                    }
                    .foregroundStyle(Theme.txt)
                    Spacer()
                    StatusTag(text: b.deltaLabel)
                }
                .padding(.top, 8)
                Sparkline(points: b.trend).padding(.top, 14)
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("—").font(Typeface.serif(78)).foregroundStyle(Theme.txt3)
                    Text("calibrating").font(Typeface.sans(15)).foregroundStyle(Theme.txt3)
                }
                .padding(.top, 8)
                Text("Your Biological Age unlocks once enough Health history is synced.")
                    .font(Typeface.sans(12)).foregroundStyle(Theme.txt3).padding(.top, 4)
            }

            Divider().overlay(Theme.line).padding(.top, 16)
            HStack(spacing: 0) {
                heroStat("HRV", fmt(store.readings?.hrvSDNN, "%.0f"))
                heroDivider
                heroStat("Rest HR", fmt(store.readings?.restingHR, "%.0f"))
                heroDivider
                heroStat("VO₂max", fmt(store.readings?.vo2Max, "%.0f"))
                heroDivider
                heroStat("PBF", fmt(store.latestInBody.pbfPct, "%.1f"))
            }
            .padding(.top, 14)
        }
    }

    private func heroStat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label.uppercased()).font(Typeface.mono(10)).foregroundStyle(Theme.txt3)
            Text(value).font(Typeface.mono(18, weight: .semibold)).foregroundStyle(Theme.txt).padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var heroDivider: some View { Rectangle().fill(Theme.line).frame(width: 1, height: 30) }

    private func fmt(_ v: Double?, _ f: String) -> String {
        guard let v else { return "—" }
        return String(format: f, v)
    }
}

#Preview {
    TodayView(store: .demo()).preferredColorScheme(.dark)
}
