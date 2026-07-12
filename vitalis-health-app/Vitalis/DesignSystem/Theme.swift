import SwiftUI

/// Design tokens ported from vitalis3.html (:root variables). §8 of the spec.
enum Theme {
    // Surfaces
    static let bg        = Color(hex: 0x0d0f12)
    static let surface   = Color(hex: 0x15181d)
    static let surface2  = Color(hex: 0x1c2026)
    static let surface3  = Color(hex: 0x232830)

    // Hairlines
    static let line      = Color(hex: 0x262b32)
    static let line2     = Color(hex: 0x323841)

    // Text
    static let txt       = Color(hex: 0xf2f4f7)
    static let txt2      = Color(hex: 0xa3acb8)
    static let txt3      = Color(hex: 0x6b7480)

    // Accent + status
    static let accent    = Color(hex: 0xe8765a)   // warm coral
    static let good      = Color(hex: 0x5ec98a)
    static let warn      = Color(hex: 0xe8b15a)
    static let cool      = Color(hex: 0x6fa8d4)
    static let mut       = Color(hex: 0x8a92e0)   // muted violet

    // Tinted fills (status backgrounds)
    static let goodFill  = Color(hex: 0x5ec98a, alpha: 0.10)
    static let goodLine  = Color(hex: 0x5ec98a, alpha: 0.25)
    static let coolFill  = Color(hex: 0x6fa8d4, alpha: 0.10)
    static let coolLine  = Color(hex: 0x6fa8d4, alpha: 0.25)
    static let accentTint = Color(hex: 0xe8765a, alpha: 0.22)
}

/// Spacing / radius scale.
enum Metrics {
    static let screenPad: CGFloat = 22
    static let cardRadius: CGFloat = 18
    static let heroRadius: CGFloat = 22
    static let smallRadius: CGFloat = 11
    static let gap: CGFloat = 10
}

extension Color {
    init(hex: UInt, alpha: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: alpha
        )
    }
}

extension View {
    /// Standard flat card surface used across the app.
    func card(radius: CGFloat = Metrics.cardRadius,
              padding: CGFloat = 18) -> some View {
        self
            .padding(padding)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: radius).strokeBorder(Theme.line, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: radius))
    }
}
