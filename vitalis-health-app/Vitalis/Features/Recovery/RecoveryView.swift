import SwiftUI

struct RecoveryView: View {
    @Bindable var store: HealthStore
    @State private var period = "1W"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScreenHeader(title: "Recovery", subtitle: "MORNING READINESS")
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 8)

                PeriodToggle(selection: $period)
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 10)

                hero.padding(.horizontal, Metrics.screenPad).padding(.top, 14)

                SectionLabel(title: "Today's Inputs", trailing: "Method →")
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 20)

                if let inputs = store.recovery?.inputs, !inputs.isEmpty {
                    RowCard {
                        ForEach(Array(inputs.enumerated()), id: \.element.id) { idx, input in
                            MetricRow(title: input.name, subtitle: input.detail,
                                      value: input.value, unit: input.unit, delta: input.deltaText)
                            if idx < inputs.count - 1 { RowDivider() }
                        }
                    }
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 12)
                }

                if let note = store.recovery?.coachNote {
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
        let r = store.recovery
        HeroCard {
            VStack(spacing: 0) {
                Text("Today").monoLabel(color: Theme.accent)
                if let score = r?.todayScore {
                    HStack(alignment: .firstTextBaseline, spacing: 2) {
                        Text("\(score)").font(Typeface.serif(84))
                        Text("%").font(Typeface.sans(24)).foregroundStyle(Theme.txt3)
                    }
                    .foregroundStyle(Theme.txt).padding(.top, 8)
                    HStack(spacing: 8) {
                        if let band = r?.band {
                            StatusTag(text: band.label,
                                      fg: band.color, fill: band.color.opacity(0.1), stroke: band.color.opacity(0.25))
                        }
                        if let avg = r?.weekAverage {
                            StatusTag(text: "7-day avg \(avg)%",
                                      fg: Theme.txt2, fill: Theme.surface2, stroke: Theme.surface2)
                        }
                    }
                    .padding(.top, 10)
                    if let r, !r.trend.isEmpty {
                        Sparkline(points: r.trend, color: r.band?.color ?? Theme.good, showDots: true, height: 56)
                            .padding(.top, 16)
                    }
                } else {
                    Text("—").font(Typeface.serif(84)).foregroundStyle(Theme.txt3).padding(.top, 8)
                    Text("Recovery scoring unlocks after ~7 days of synced data.")
                        .font(Typeface.sans(12)).foregroundStyle(Theme.txt3)
                        .multilineTextAlignment(.center).padding(.top, 6).padding(.horizontal, 20)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }
}

#Preview {
    RecoveryView(store: .demo()).preferredColorScheme(.dark)
}
