// colors.js

export const COLORS = {
  background:     '#0f172a',
  surface:        '#111827',
  surfaceSoft:    '#1e293b',

  textPrimary:    '#f8fafc',
  textSecondary:  '#cbd5e1',
  textMuted:      '#94a3b8',

  accent: '#38bdf8',

  selectedPrimary:    '#ffee32',
  selectedComparison: '#9d4edd',

  scoreLow:     '#ef4444',    // red      // '#D55E00', 
  scoreMedium:  '#E69F00',    // orange   // '#f97316',  
  scoreHigh:    '#22c55e',    // green    // '#009E73',   
};

// Okabe-Ito Palette - colour blind friendly
export const CITY_COLORS = [
    '#E69F00',    // primary
    '#56B4E9',    // compared 1
    '#009E73',    // compared 2
    '#d55E00',    // compared 3   // '#CC79A7',
    '#0072B2',    // compared 4
];

// score01 is the color for the normalized score in '0' and '1'
export function getScoreColor(score01, min_score, mid_score) {
  if (score01 == null) return COLORS.textMuted;
  if (score01 < min_score) return COLORS.scoreLow;
  if (score01 < mid_score) return COLORS.scoreMedium;
  return COLORS.scoreHigh;
}
