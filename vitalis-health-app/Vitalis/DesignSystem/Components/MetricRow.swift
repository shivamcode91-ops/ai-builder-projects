import SwiftUI

/// A list row with optional leading icon, title/subtitle, and a right-aligned mono value block.
/// Covers both the Today activity list and the Recovery inputs list (icon optional).
struct MetricRow: View {
    var systemIcon: String? = nil
    var title: String
    var subtitle: String
    var value: String
    var unit: String? = nil
    var delta: String? = nil
    var deltaColor: Color = Theme.good

    var body: some View {
        HStack(spacing: 14) {
            if let systemIcon {
                Image(systemName: systemIcon)
                    .font(.system(size: 16, weight: .regular))
                    .foregroundStyle(Theme.txt2)
                    .frame(width: 34, height: 34)
                    .background(Theme.surface2)
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.line2, lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Typeface.sans(14, weight: .medium)).foregroundStyle(Theme.txt)
                Text(subtitle).font(Typeface.sans(11)).foregroundStyle(Theme.txt3)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(value).font(Typeface.mono(17)).foregroundStyle(Theme.txt)
                    if let unit {
                        Text(unit).font(Typeface.mono(10)).foregroundStyle(Theme.txt3)
                    }
                }
                if let delta {
                    Text(delta).font(Typeface.mono(10)).foregroundStyle(deltaColor)
                }
            }
        }
        .padding(.vertical, 14)
    }
}

/// Hairline-separated stack of rows inside a card (the prototype's `.mrow` list).
struct RowCard<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(spacing: 0) {
            content
        }
        .padding(.horizontal, 18)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Metrics.cardRadius).strokeBorder(Theme.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: Metrics.cardRadius))
    }
}

/// Thin divider used between rows.
struct RowDivider: View {
    var body: some View { Rectangle().fill(Theme.line).frame(height: 1) }
}
