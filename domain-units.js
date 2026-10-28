// Loads are stored in kg, always. Units are a display concern only.
export const LB = 2.2046226218;

export const roundTo = (v, step) => Math.round(v / step) * step;
export const toDisplay = (kg, unit) => kg == null ? null : unit === 'lb' ? roundTo(kg * LB, 0.5) : roundTo(kg, 0.25);
export const fromDisplay = (v, unit) => v == null || v === '' || isNaN(v) ? null : unit === 'lb' ? +(Number(v) / LB).toFixed(3) : +Number(v);
export const fmtNum = n => n == null ? '—' : Number.isInteger(n) ? String(n) : String(+n.toFixed(2));
export const fmtW = (kg, unit) => kg == null ? '—' : `${fmtNum(toDisplay(kg, unit))}${unit}`;
// Estimated maxes are rough by nature: show them to the nearest 0.5 kg / 1 lb, not 33.25.
export const fmtEst = (kg, unit) => kg == null ? '—' : `${fmtNum(roundTo(toDisplay(kg, unit), unit === 'lb' ? 1 : 0.5))}${unit}`;
// The load step the user sees, in display units (2.5kg ≈ 5lb).
export const displayStep = (incKg, unit) => unit === 'lb' ? Math.max(1, roundTo(incKg * LB, 2.5)) : incKg;
// Round a kg value to an increment that is sensible in the display unit.
export const roundLoad = (kg, incKg, unit) => unit === 'lb'
  ? +(roundTo(kg * LB, displayStep(incKg, unit)) / LB).toFixed(3)
  : roundTo(kg, incKg);
