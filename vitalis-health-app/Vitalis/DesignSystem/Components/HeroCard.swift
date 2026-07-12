import SwiftUI

/// Large flat hero container (rounded, hairline border). Content is composed by callers
/// so the same shell serves Today's bio-age, Recovery's average, Strain's total, etc.
struct HeroCard<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(22)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: Metrics.heroRadius).strokeBorder(Theme.line, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: Metrics.heroRadius))
    }
}

/// A small status tag pill (e.g. "2.2 yrs younger", "Today 85% · green").
struct StatusTag: View {
    var text: String
    var fg: Color = Theme.good
    var fill: Color = Theme.goodFill
    var stroke: Color = Theme.goodLine

    var body: some View {
        Text(text)
            .font(Typeface.sans(12, weight: .medium))
            .foregroundStyle(fg)
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(fill)
            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(stroke, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

/// Screen header: serif title + mono subtitle on the left, avatar circle on the right.
struct ScreenHeader: View {
    var title: String
    var subtitle: String
    var avatar: String = "A"

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 5) {
                Text(title).font(Typeface.serif(34)).foregroundStyle(Theme.txt)
                Text(subtitle).font(Typeface.mono(12)).foregroundStyle(Theme.txt3)
            }
            Spacer()
            Text(avatar)
                .font(Typeface.sans(13, weight: .semibold))
                .foregroundStyle(Theme.txt2)
                .frame(width: 36, height: 36)
                .background(Theme.surface2)
                .overlay(Circle().strokeBorder(Theme.line2, lineWidth: 1))
                .clipShape(Circle())
        }
    }
}

/// Footer attribution line.
struct FooterNote: View {
    var text: String
    var body: some View {
        Text(text)
            .font(Typeface.mono(11))
            .foregroundStyle(Theme.txt3)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 22)
    }
}
