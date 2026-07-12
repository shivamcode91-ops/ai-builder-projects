import SwiftUI

struct CoachView: View {
    @Bindable var store: HealthStore
    @State private var query = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                ScreenHeader(title: "Coach", subtitle: "AI · GROUNDED IN YOUR DATA")
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 8)

                if store.coachAnswers.isEmpty {
                    CalibratingCard(title: "Coach is warming up",
                                    message: "Once your scores compute, Coach will answer in plain language and cite the data it used.",
                                    systemIcon: "bubble.left.and.text.bubble.right")
                        .padding(.horizontal, Metrics.screenPad).padding(.top, 14)
                } else {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(store.coachAnswers.enumerated()), id: \.element.id) { idx, a in
                            Text(a.question)
                                .font(Typeface.serif(19)).foregroundStyle(Theme.txt)
                                .padding(.top, idx == 0 ? 6 : 18).padding(.bottom, 7)
                            Text(a.answer)
                                .font(Typeface.sans(13.5)).foregroundStyle(Theme.txt2).lineSpacing(4)
                                .fixedSize(horizontal: false, vertical: true)
                            SourceChips(sources: a.sources).padding(.top, 8)
                        }
                    }
                    .padding(.horizontal, Metrics.screenPad).padding(.top, 4)
                }

                askBar.padding(.horizontal, Metrics.screenPad).padding(.top, 18)

                VStack(spacing: 0) {
                    Divider().overlay(Theme.line)
                    ForEach(store.coachPrompts, id: \.self) { p in
                        Button { } label: {
                            HStack {
                                Text(p).font(Typeface.sans(13.5)).foregroundStyle(Theme.txt)
                                Spacer()
                                Text("→").font(Typeface.mono(13)).foregroundStyle(Theme.accent)
                            }
                            .padding(.vertical, 14)
                        }
                        .buttonStyle(.plain)
                        Divider().overlay(Theme.line)
                    }
                }
                .padding(.horizontal, Metrics.screenPad).padding(.top, 22)

                FooterNote(text: "answers cite the data they draw from")
            }
        }
        .background(Theme.bg)
    }

    private var askBar: some View {
        HStack(spacing: 8) {
            TextField("", text: $query, prompt: Text("Ask about your data…").foregroundColor(Theme.txt3))
                .font(Typeface.sans(13)).foregroundStyle(Theme.txt)
                .padding(.leading, 14)
            Button { } label: {
                Image(systemName: "arrow.right")
                    .font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                    .frame(width: 34, height: 34)
                    .background(Theme.accent).clipShape(RoundedRectangle(cornerRadius: 9))
            }
            .buttonStyle(.plain)
        }
        .padding(6)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.line2, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

#Preview {
    CoachView(store: .demo()).preferredColorScheme(.dark)
}
