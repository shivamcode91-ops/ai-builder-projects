import SwiftUI

/// One of the three tappable readout tiles on Today. Serif value, thin meter, mono status.
struct ScoreCard: View {
    var tile: ScoreTile
    var action: () -> Void = {}

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text(tile.name)
                        .font(Typeface.sans(11, weight: .medium))
                        .foregroundStyle(Theme.txt2)
                    Spacer()
                    Text(tile.change.text)
                        .font(Typeface.mono(9))
                        .foregroundStyle(tile.change.direction == .flat ? Theme.txt3 : Theme.good)
                }

                HStack(alignment: .firstTextBaseline, spacing: 1) {
                    Text(tile.value).font(Typeface.serif(32))
                    if let unit = tile.unit {
                        Text(unit).font(Typeface.sans(13)).foregroundStyle(Theme.txt3)
                    }
                }
                .foregroundStyle(Theme.txt)
                .padding(.top, 8)

                meter.padding(.top, 10)

                Text(tile.status)
                    .font(Typeface.mono(10))
                    .foregroundStyle(Theme.txt3)
                    .padding(.top, 7)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(EdgeInsets(top: 14, leading: 12, bottom: 14, trailing: 12))
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.line, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(PressableStyle())
    }

    private var meter: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.surface2)
                Capsule().fill(tile.fillColor)
                    .frame(width: max(3, geo.size.width * tile.fill))
            }
        }
        .frame(height: 3)
    }
}

/// Subtle scale-down on press (the `.scard:active` transform).
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}
