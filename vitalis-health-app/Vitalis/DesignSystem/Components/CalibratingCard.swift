import SwiftUI

/// Honest empty state for a derived metric that has no value yet (§10: never fake a number).
struct CalibratingCard: View {
    var title: String
    var message: String
    var systemIcon: String = "hourglass"

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: systemIcon)
                .font(.system(size: 22))
                .foregroundStyle(Theme.txt3)
            Text(title).font(Typeface.sans(14, weight: .semibold)).foregroundStyle(Theme.txt)
            Text(message)
                .font(Typeface.sans(12)).foregroundStyle(Theme.txt3)
                .multilineTextAlignment(.center).lineSpacing(2)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 22)
        .card()
    }
}
