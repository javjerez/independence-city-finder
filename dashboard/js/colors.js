// colors.js

export const COLORS = {
  background: '#0f172a',
  surface: '#111827',
  surfaceSoft: '#1e293b',

  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',

  accent: '#38bdf8',

  selectedPrimary: '#ff7a3d',
  selectedComparison: '#facc15',

  scoreLow: '#ef4444',     // red
  scoreMedium: '#f97316',  // orange
  scoreHigh: '#22c55e',    // green
};

// score01 is the color for the normalized score in '0' and '1'
export function getScoreColor(score01, min_score, mid_score) {
  if (score01 == null) return COLORS.textMuted;

  if (score01 < min_score) return COLORS.scoreLow;
  if (score01 < mid_score) return COLORS.scoreMedium;
  return COLORS.scoreHigh;
}
