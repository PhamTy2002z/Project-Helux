/**
 * Chart theming utilities — resolves CSS variables at runtime for Recharts.
 * All functions require DOM access; call inside component body or useEffect.
 */

/**
 * Returns resolved CSS variable values for chart theming.
 * Call inside a component or effect — requires DOM access.
 */
export function getChartColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    text: style.getPropertyValue("--text-muted").trim(),
    textStrong: style.getPropertyValue("--text").trim(),
    grid: style.getPropertyValue("--border").trim(),
    surface: style.getPropertyValue("--surface").trim(),
    border: style.getPropertyValue("--border").trim(),
    accent: style.getPropertyValue("--accent").trim(),
    accentStrong: style.getPropertyValue("--accent-strong").trim(),
    success: style.getPropertyValue("--success").trim(),
    warning: style.getPropertyValue("--warning").trim(),
    danger: style.getPropertyValue("--danger").trim(),
  };
}

/** Static series palette — works in both modes (vivid mid-range colors) */
export const SERIES_COLORS = [
  "#3B82F6", // blue-500
  "#22C55E", // green-500
  "#F59E0B", // amber-500
  "#EF4444", // red-500
  "#8B5CF6", // violet-500
  "#06B6D4", // cyan-500
  "#EC4899", // pink-500
  "#F97316", // orange-500
];
