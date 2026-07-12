import SwiftUI

/// Shown when Health access hasn't been granted yet. Privacy-forward explainer + connect CTA.
struct HealthAuthView: View {
    var phase: HealthStore.Phase
    var onConnect: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            Image(systemName: "heart.text.square")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Theme.accent)
                .frame(width: 88, height: 88)
                .background(Theme.surface2)
                .overlay(RoundedRectangle(cornerRadius: 22).strokeBorder(Theme.line2, lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: 22))

            Text("Connect Apple Health")
                .font(Typeface.serif(30)).foregroundStyle(Theme.txt)
                .padding(.top, 22)

            Text("Vitalis reads your heart, sleep and activity data to estimate Biological Age, Recovery and Strain.")
                .font(Typeface.sans(14)).foregroundStyle(Theme.txt2)
                .multilineTextAlignment(.center).lineSpacing(3)
                .padding(.horizontal, 36).padding(.top, 10)

            VStack(spacing: 14) {
                bullet("lock.shield", "On-device only", "Nothing leaves your iPhone. No servers, no account.")
                bullet("eye.slash", "Read-only", "Vitalis never writes anything back to Health.")
                bullet("waveform.path.ecg", "Your numbers", "Estimates grounded in your own metrics — not medical advice.")
            }
            .padding(.horizontal, 30).padding(.top, 26)

            Spacer()

            if phase == .denied {
                Text("Health access is off. Enable it in Settings › Privacy › Health › Vitalis.")
                    .font(Typeface.sans(12)).foregroundStyle(Theme.warn)
                    .multilineTextAlignment(.center).padding(.horizontal, 30).padding(.bottom, 12)
            } else if phase == .unavailable {
                Text("Health data isn't available on this device.")
                    .font(Typeface.sans(12)).foregroundStyle(Theme.txt3)
                    .padding(.bottom, 12)
            }

            Button(action: onConnect) {
                Text(phase == .denied ? "Open Settings" : "Connect Apple Health")
                    .font(Typeface.sans(15, weight: .semibold)).foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(.vertical, 15)
                    .background(Theme.accent).clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, Metrics.screenPad)
            .disabled(phase == .unavailable)
            .opacity(phase == .unavailable ? 0.5 : 1)

            Text("Estimates, not diagnoses.")
                .font(Typeface.mono(10)).foregroundStyle(Theme.txt3)
                .padding(.vertical, 16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.bg.ignoresSafeArea())
    }

    private func bullet(_ icon: String, _ title: String, _ body: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 16)).foregroundStyle(Theme.accent)
                .frame(width: 26)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Typeface.sans(14, weight: .semibold)).foregroundStyle(Theme.txt)
                Text(body).font(Typeface.sans(12)).foregroundStyle(Theme.txt3).lineSpacing(2)
            }
            Spacer()
        }
    }
}

#Preview {
    HealthAuthView(phase: .needsAuthorization) {}
        .preferredColorScheme(.dark)
}
