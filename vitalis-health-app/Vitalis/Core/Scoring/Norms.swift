import Foundation

/// Biological sex used to pick reference norms. Parsed from InBody's "M"/"F".
enum BioSex {
    case male, female
    init(_ raw: String) { self = raw.uppercased().hasPrefix("F") ? .female : .male }
}

/// Age/sex reference norms → 0–100 sub-scores (higher = younger/fitter), used by §4a.
///
/// Anchors are *approximate* population references for a v1 estimate, not clinical
/// cut-offs. Each marker defines three anchor values mapped to sub-scores 0 / 50 / 100;
/// values interpolate (and clamp) between them. Tune the anchors freely — nothing else
/// depends on their exact values.
///
/// Sources (informal, v1): VO₂max — Cooper Institute / ACSM age-sex percentiles;
/// HRV SDNN-by-age — Umetani et al. 1998; RHR — common athletic/clinical bands.
enum Norms {

    /// Three reference points for a marker: the value scoring 0, 50, and 100.
    private struct Anchor { let p0: Double; let p50: Double; let p100: Double }

    /// Map a measured value onto 0–100 by piecewise-linear interpolation through the
    /// anchors. Handles both "higher is better" (p0 < p100) and inverted markers.
    private static func score(_ value: Double, _ a: Anchor) -> Double {
        let ascending = a.p100 >= a.p0
        let v = value
        func lerp(_ lo: Double, _ hi: Double, _ s0: Double, _ s1: Double) -> Double {
            guard hi != lo else { return s0 }
            return s0 + (v - lo) / (hi - lo) * (s1 - s0)
        }
        let s: Double
        if ascending {
            if v <= a.p0 { s = 0 }
            else if v <= a.p50 { s = lerp(a.p0, a.p50, 0, 50) }
            else if v <= a.p100 { s = lerp(a.p50, a.p100, 50, 100) }
            else { s = 100 }
        } else {
            if v >= a.p0 { s = 0 }
            else if v >= a.p50 { s = lerp(a.p0, a.p50, 0, 50) }
            else if v >= a.p100 { s = lerp(a.p50, a.p100, 50, 100) }
            else { s = 100 }
        }
        return min(100, max(0, s))
    }

    private static func ageBand(_ age: Int) -> Int { min(60, max(20, (age / 10) * 10)) }

    // MARK: VO₂max (mL/kg/min) — higher is better

    static func vo2maxSubscore(_ vo2: Double, age: Int, sex: BioSex) -> Double {
        let a: Anchor
        switch (sex, ageBand(age)) {
        case (.male, 20):   a = .init(p0: 33, p50: 45, p100: 56)
        case (.male, 30):   a = .init(p0: 31, p50: 43, p100: 53)
        case (.male, 40):   a = .init(p0: 29, p50: 41, p100: 50)
        case (.male, _):    a = .init(p0: 26, p50: 37, p100: 46)
        case (.female, 20): a = .init(p0: 28, p50: 37, p100: 49)
        case (.female, 30): a = .init(p0: 27, p50: 35, p100: 46)
        case (.female, 40): a = .init(p0: 25, p50: 33, p100: 43)
        case (.female, _):  a = .init(p0: 22, p50: 30, p100: 39)
        }
        return score(vo2, a)
    }

    /// Non-exercise VO₂max estimate when HealthKit has none (§4a fallback).
    /// Uberoth/HR-ratio style: vo2 ≈ 15 × (HRmax / RHR), HRmax ≈ 208 − 0.7·age.
    static func estimatedVO2max(restingHR: Double, age: Int) -> Double {
        guard restingHR > 0 else { return 0 }
        let hrMax = 208 - 0.7 * Double(age)
        return 15.0 * (hrMax / restingHR)
    }

    // MARK: HRV SDNN (ms) — higher is better

    static func hrvSubscore(_ hrv: Double, age: Int) -> Double {
        let a: Anchor
        switch ageBand(age) {
        case 20: a = .init(p0: 25, p50: 55, p100: 100)
        case 30: a = .init(p0: 22, p50: 48, p100: 90)
        case 40: a = .init(p0: 18, p50: 40, p100: 78)
        default: a = .init(p0: 14, p50: 32, p100: 65)
        }
        return score(hrv, a)
    }

    // MARK: Resting HR (bpm) — lower is better (inverted anchors)

    static func rhrSubscore(_ rhr: Double, age: Int, sex: BioSex) -> Double {
        // p0 = poor (high), p100 = excellent (low).
        let a = sex == .male
            ? Anchor(p0: 82, p50: 66, p100: 49)
            : Anchor(p0: 85, p50: 70, p100: 54)
        return score(rhr, a)
    }

    // MARK: Body fat % (0–100 value, e.g. 17.3) — optimal mid-range

    static func bodyFatSubscore(_ pbf: Double, sex: BioSex) -> Double {
        // Athletic/optimal scores ~100; essential-low and obese both score lower.
        let optimal: Double = sex == .male ? 12 : 20
        let high: Double     = sex == .male ? 28 : 36
        if pbf <= optimal { return 100 }
        if pbf >= high { return 20 }
        return 100 - (pbf - optimal) / (high - optimal) * 80
    }

    // MARK: Activity (steps) — consistency proxy

    static func activitySubscore(steps: Double, target: Double = 10_000) -> Double {
        guard target > 0 else { return 0 }
        return min(100, max(0, steps / target * 100))
    }
}
