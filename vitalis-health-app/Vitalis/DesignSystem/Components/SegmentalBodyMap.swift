import SwiftUI

/// Segmental lean-mass map: a stylized figure flanked by limb segment chips. §6 Body tab.
struct SegmentalBodyMap: View {
    var scan: InBodyScan

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            VStack(spacing: 8) {
                segChip("L Arm", scan.segLean.armL)
                segChip("L Leg", scan.segLean.legL)
            }
            VStack(spacing: 6) {
                figure
                segChip("Trunk", scan.segLean.trunk, fullWidth: true)
            }
            VStack(spacing: 8) {
                segChip("R Arm", scan.segLean.armR)
                segChip("R Leg", scan.segLean.legR)
            }
        }
        .padding(EdgeInsets(top: 20, leading: 18, bottom: 20, trailing: 18))
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: Metrics.cardRadius).strokeBorder(Theme.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: Metrics.cardRadius))
    }

    private func segChip(_ label: String, _ value: Double, fullWidth: Bool = false) -> some View {
        VStack(spacing: 3) {
            Text(label.uppercased()).font(Typeface.mono(9)).foregroundStyle(Theme.txt3)
            Text(String(format: "%.2f", value)).font(Typeface.mono(17, weight: .semibold)).foregroundStyle(Theme.txt)
            Text("Normal").font(Typeface.sans(9)).foregroundStyle(Theme.good)
        }
        .frame(maxWidth: fullWidth ? .infinity : nil)
        .padding(10)
        .background(Theme.surface2)
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.line2, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    /// Simple stylized body: head, accent-tinted torso, four limbs.
    private var figure: some View {
        Canvas { ctx, size in
            let w = size.width, h = size.height
            func rrect(_ x: CGFloat, _ y: CGFloat, _ rw: CGFloat, _ rh: CGFloat, _ r: CGFloat) -> Path {
                Path(roundedRect: CGRect(x: x, y: y, width: rw, height: rh), cornerRadius: r)
            }
            // head
            let head = Path(ellipseIn: CGRect(x: w*0.5 - 9, y: 4, width: 18, height: 18))
            ctx.fill(head, with: .color(Theme.surface2))
            ctx.stroke(head, with: .color(Theme.line2), lineWidth: 1)
            // torso (accent)
            let torso = rrect(w*0.32, 25, w*0.36, h*0.27, 8)
            ctx.fill(torso, with: .color(Theme.accentTint))
            ctx.stroke(torso, with: .color(Theme.accent), lineWidth: 1)
            // arms
            for ax in [w*0.08, w*0.74] {
                let arm = rrect(ax, 29, w*0.18, h*0.23, 5)
                ctx.fill(arm, with: .color(Theme.surface2))
                ctx.stroke(arm, with: .color(Theme.line2), lineWidth: 1)
            }
            // legs
            for lx in [w*0.33, w*0.52] {
                let leg = rrect(lx, h*0.47, w*0.15, h*0.3, 4)
                ctx.fill(leg, with: .color(Theme.surface2))
                ctx.stroke(leg, with: .color(Theme.line2), lineWidth: 1)
            }
        }
        .frame(width: 60, height: 148)
    }
}
