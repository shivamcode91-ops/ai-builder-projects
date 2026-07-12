import SwiftUI

/// Coral left-border note card with a "◆ Coach" mono label. Accepts markdown for bolding.
struct CoachNote: View {
    var label: String = "Coach"
    var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text("◆").font(.system(size: 10))
                Text(label).monoLabel(color: Theme.accent)
            }
            Text(attributed)
                .font(Typeface.sans(13.5))
                .foregroundStyle(Theme.txt2)
                .lineSpacing(3.5)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(EdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16))
        .background(Theme.surface)
        .overlay(alignment: .leading) {
            Rectangle().fill(Theme.accent).frame(width: 2)
        }
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Theme.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var attributed: AttributedString {
        (try? AttributedString(markdown: text)) ?? AttributedString(text)
    }
}

#Preview {
    CoachNote(text: "HRV is **11% above baseline** and recovery is green.")
        .padding().background(Theme.bg)
}
