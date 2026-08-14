// Money is paise everywhere internally. ₹1 = 100 paise.
// Display is Indian-grouped rupees: ₹5,00,000 — never ₹500,000.

export function formatPaise(paise) {
  const n = Number(paise) || 0;
  const rupees = n / 100;
  const hasFraction = n % 100 !== 0;
  return (
    "₹" +
    rupees.toLocaleString("en-IN", {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: hasFraction ? 2 : 0,
    })
  );
}

// "50× your limit" reads better than "exceeds by 5000%".
export function formatMultiple(x) {
  if (!Number.isFinite(x)) return "far above";
  const rounded = Math.round(x * 10) / 10;
  return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)) + "×";
}

// Plain names for the actions. A business owner should never have to read
// "refund.create" to understand what their assistant tried to do.
export const TOOL_LABELS = {
  "refund.create": "Refund a customer",
  "link.create": "Send a payment link",
  "payout.create": "Pay money out",
  "internal.transfer": "Move money internally",
  "mandate.update": "Change your permissions",
};

export function toolLabel(tool) {
  return TOOL_LABELS[tool] || tool || "Unknown action";
}
