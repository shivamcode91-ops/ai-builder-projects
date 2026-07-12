import SwiftUI

/// Segmented 1D / 1W / 1M / 3M / 6M selector. Phase 1: visual only; Phase 7 wires ranges.
struct PeriodToggle: View {
    static let periods = ["1D", "1W", "1M", "3M", "6M"]
    @Binding var selection: String

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Self.periods, id: \.self) { p in
                Button { selection = p } label: {
                    Text(p)
                        .font(Typeface.mono(11, weight: .medium))
                        .foregroundStyle(selection == p ? Theme.txt : Theme.txt3)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 7)
                        .background(selection == p ? Theme.surface3 : .clear)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Metrics.smallRadius).strokeBorder(Theme.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: Metrics.smallRadius))
    }
}
