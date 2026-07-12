import SwiftUI

/// A composition table row: name (+ optional subnote) on the left, mono value (+ optional
/// range or pill) on the right, hairline separated. §6 Body composition table.
struct DataTable: View {
    var rows: [Row]

    struct Row: Identifiable {
        let id = UUID()
        var name: String
        var sub: String? = nil
        var value: String? = nil
        var range: String? = nil
        var pill: Pill? = nil
    }

    enum Pill { case ok(String), low(String), warn(String)
        var text: String { switch self { case .ok(let t), .low(let t), .warn(let t): return t } }
        var fg: Color { switch self { case .ok: return Theme.good; case .low: return Theme.cool; case .warn: return Theme.warn } }
        var bg: Color { fg.opacity(0.12) }
    }

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { idx, row in
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(row.name).font(Typeface.sans(13.5, weight: .medium)).foregroundStyle(Theme.txt)
                        if let sub = row.sub {
                            Text(sub).font(Typeface.sans(11)).foregroundStyle(Theme.txt3)
                        }
                    }
                    Spacer()
                    HStack(spacing: 6) {
                        if let value = row.value {
                            Text(value).font(Typeface.mono(13.5, weight: .medium)).foregroundStyle(Theme.txt)
                        }
                        if let range = row.range {
                            Text(range).font(Typeface.mono(10)).foregroundStyle(Theme.txt3)
                        }
                        if let pill = row.pill {
                            Text(pill.text)
                                .font(Typeface.mono(10, weight: .medium))
                                .foregroundStyle(pill.fg)
                                .padding(.horizontal, 7).padding(.vertical, 2)
                                .background(pill.bg)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                    }
                }
                .padding(.vertical, 12)
                if idx < rows.count - 1 { RowDivider() }
            }
        }
        .card()
    }
}
