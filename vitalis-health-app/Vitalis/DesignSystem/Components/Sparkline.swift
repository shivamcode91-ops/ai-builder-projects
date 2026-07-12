import SwiftUI

/// Thin-stroke line with an end dot. Matches the prototype's `.spark` polylines. §8.
struct Sparkline: View {
    var points: [Double]
    var color: Color = Theme.accent
    var showDots: Bool = false
    var height: CGFloat = 40

    var body: some View {
        GeometryReader { geo in
            let path = linePath(in: geo.size)
            path.stroke(color, style: StrokeStyle(lineWidth: 1.6, lineCap: .round, lineJoin: .round))
            if showDots {
                ForEach(Array(normalized(in: geo.size).enumerated()), id: \.offset) { _, p in
                    Circle().fill(color).frame(width: 4, height: 4).position(p)
                }
            }
            if let last = normalized(in: geo.size).last {
                Circle().fill(color).frame(width: 5.2, height: 5.2).position(last)
            }
        }
        .frame(height: height)
    }

    private func normalized(in size: CGSize) -> [CGPoint] {
        guard points.count > 1 else { return [] }
        let minV = points.min() ?? 0
        let maxV = points.max() ?? 1
        let span = max(maxV - minV, 0.0001)
        let stepX = size.width / CGFloat(points.count - 1)
        return points.enumerated().map { i, v in
            let x = CGFloat(i) * stepX
            let y = size.height - CGFloat((v - minV) / span) * size.height
            return CGPoint(x: x, y: y)
        }
    }

    private func linePath(in size: CGSize) -> Path {
        var p = Path()
        let pts = normalized(in: size)
        guard let first = pts.first else { return p }
        p.move(to: first)
        pts.dropFirst().forEach { p.addLine(to: $0) }
        return p
    }
}
