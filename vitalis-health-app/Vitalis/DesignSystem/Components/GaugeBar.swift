import SwiftUI

/// Horizontal range gauge with a white pin. Used for BMI and PBF on the Body tab.
struct GaugeBar: View {
    var label: String
    var valueText: String
    var pin: Double                 // 0...1 position along the track
    var lowLabel: String
    var midLabel: String
    var highLabel: String

    private let gradient = LinearGradient(
        stops: [
            .init(color: Theme.cool, location: 0.0),
            .init(color: Theme.good, location: 0.38),
            .init(color: Theme.good, location: 0.60),
            .init(color: Theme.warn, location: 0.80),
            .init(color: Theme.accent, location: 1.0),
        ],
        startPoint: .leading, endPoint: .trailing
    )

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text(label).font(Typeface.sans(11)).foregroundStyle(Theme.txt2)
                Spacer()
                Text(valueText).font(Typeface.mono(13)).foregroundStyle(Theme.txt)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(gradient)
                    Capsule().fill(.white)
                        .frame(width: 2, height: 12)
                        .overlay(Capsule().strokeBorder(Theme.bg, lineWidth: 2).frame(width: 6, height: 16))
                        .offset(x: max(0, min(geo.size.width - 2, geo.size.width * pin)) - 1, y: 0)
                }
            }
            .frame(height: 6)
            HStack {
                Text(lowLabel); Spacer(); Text(midLabel); Spacer(); Text(highLabel)
            }
            .font(Typeface.mono(9))
            .foregroundStyle(Theme.txt3)
        }
    }
}
