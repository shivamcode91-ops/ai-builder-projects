import SwiftUI

/// Type styles. Prototype uses Instrument Serif (display), Geist (sans), Geist Mono (numbers).
/// We map to SF-native equivalents: New York for the serif display, system sans for body,
/// and monospaced digits for tabular numbers. §8.
enum Typeface {
    /// Serif display — big hero numbers and section headlines.
    static func serif(_ size: CGFloat) -> Font {
        .system(size: size, weight: .regular, design: .serif)
    }
    /// Monospaced — metrics, axes, labels (SF Mono equivalent).
    static func mono(_ size: CGFloat, weight: Font.Weight = .medium) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }
    /// Sans body.
    static func sans(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }
}

extension View {
    /// Uppercase mono section label (the `.lbl` / `.k` pattern in the prototype).
    func monoLabel(color: Color = Theme.txt3) -> some View {
        self.font(Typeface.mono(11, weight: .medium))
            .textCase(.uppercase)
            .tracking(1)
            .foregroundStyle(color)
    }
}

/// Reusable section header: uppercase mono label on the left, optional trailing link.
struct SectionLabel: View {
    let title: String
    var trailing: String? = nil
    var trailingColor: Color = Theme.accent

    var body: some View {
        HStack {
            Text(title).monoLabel()
            Spacer()
            if let trailing {
                Text(trailing)
                    .font(Typeface.mono(11))
                    .foregroundStyle(trailingColor)
            }
        }
    }
}
