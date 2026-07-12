import SwiftUI

struct BodyView: View {
    @Bindable var store: HealthStore

    var body: some View {
        let s = store.latestInBody
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScreenHeader(title: "Body", subtitle: "INBODY 260 · JUN 3 22:05")
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 8)

                hero(s).padding(.horizontal, Metrics.screenPad).padding(.top, 14)

                SectionLabel(title: "Obesity Analysis")
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 20)
                VStack(spacing: 14) {
                    GaugeBar(label: "BMI", valueText: String(format: "%.1f kg/m²", s.bmi),
                             pin: 0.24, lowLabel: "Under", midLabel: "Normal", highLabel: "Over")
                    RowDivider()
                    GaugeBar(label: "Percent Body Fat", valueText: String(format: "%.1f %%", s.pbfPct),
                             pin: 0.33, lowLabel: "10", midLabel: "Normal", highLabel: "30+")
                }
                .card()
                .padding(.horizontal, Metrics.screenPad).padding(.top, 12)

                SectionLabel(title: "Segmental Lean Mass", trailing: "all normal", trailingColor: Theme.txt3)
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 20)
                SegmentalBodyMap(scan: s)
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 12)

                SectionLabel(title: "Composition")
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 20)
                DataTable(rows: [
                    .init(name: "Total Body Water", value: "31.4 L", range: "32.5–39.7"),
                    .init(name: "Protein", sub: "below range", value: "8.5 kg", range: "8.7–10.7"),
                    .init(name: "Mineral", value: "2.81 kg", range: "3.0–3.67"),
                    .init(name: "Visceral Fat", sub: "Level 3", pill: .low("Low")),
                    .init(name: "Waist–Hip Ratio", value: "0.84"),
                    .init(name: "Recommended Intake", value: "2,567 kcal"),
                ])
                .padding(.horizontal, Metrics.screenPad).padding(.top, 12)

                CoachNote(label: "InBody Plan",
                          text: "Target weight **57.7 kg** — a **+6.0 kg** gain, almost all muscle (control +6.3 kg, fat −0.3 kg). Train strength, eat a slight surplus over 2,567 kcal, and close the protein gap.")
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 16)

                SectionLabel(title: "Add a New Scan")
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 20)
                importCard.padding(.horizontal, Metrics.screenPad).padding(.top, 12)

                FooterNote(text: "last scan Jun 3 · scans tracked over time")
            }
        }
        .background(Theme.bg)
    }

    private func hero(_ s: InBodyScan) -> some View {
        HeroCard {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("InBody Score").monoLabel(color: Theme.accent)
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text("\(s.score)").font(Typeface.serif(62))
                        Text("/ 100").font(Typeface.sans(16)).foregroundStyle(Theme.txt3)
                    }.foregroundStyle(Theme.txt)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(Int(s.heightCm)) cm · \(s.age) · \(s.sex)")
                        .font(Typeface.mono(11)).foregroundStyle(Theme.txt3)
                    HStack(alignment: .firstTextBaseline, spacing: 2) {
                        Text(String(format: "%.1f", s.weightKg)).font(Typeface.serif(30))
                        Text("kg").font(Typeface.sans(14)).foregroundStyle(Theme.txt3)
                    }.foregroundStyle(Theme.txt)
                }
            }
            Divider().overlay(Theme.line).padding(.top, 16)
            HStack(spacing: 0) {
                stat("SMM", String(format: "%.1f", s.smmKg), "kg")
                vdiv; stat("Fat Mass", String(format: "%.1f", s.bodyFatMassKg), "kg")
                vdiv; stat("PBF", String(format: "%.1f", s.pbfPct), "%")
                vdiv; stat("BMR", "\(s.bmrKcal)", "kcal")
            }
            .padding(.top, 14)
        }
    }

    private func stat(_ label: String, _ value: String, _ unit: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label.uppercased()).font(Typeface.mono(10)).foregroundStyle(Theme.txt3)
            Text(value).font(Typeface.mono(18, weight: .semibold)).foregroundStyle(Theme.txt).padding(.top, 2)
            Text(unit).font(Typeface.mono(9)).foregroundStyle(Theme.txt3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    private var vdiv: some View { Rectangle().fill(Theme.line).frame(width: 1, height: 36) }

    private var importCard: some View {
        VStack(spacing: 10) {
            Image(systemName: "doc.viewfinder")
                .font(.system(size: 22)).foregroundStyle(Theme.accent)
                .frame(width: 44, height: 44)
                .background(Theme.surface2)
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.line2, lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            Text("Import an InBody result").font(Typeface.sans(14, weight: .semibold)).foregroundStyle(Theme.txt)
            Text("Snap a photo of the printout — we'll read the values automatically and track changes over time.")
                .font(Typeface.sans(12)).foregroundStyle(Theme.txt3).multilineTextAlignment(.center).lineSpacing(2)
            Button { } label: {
                Text("Scan printout").font(Typeface.sans(13, weight: .semibold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 11)
                    .background(Theme.accent).clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain).padding(.top, 4)
        }
        .padding(18)
        .frame(maxWidth: .infinity)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.line2, style: StrokeStyle(lineWidth: 1, dash: [4])))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

#Preview {
    BodyView(store: .demo()).preferredColorScheme(.dark)
}
