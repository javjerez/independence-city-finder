// ============================================================
//  comparisonV2.js — Fingerprint Radar + Per-Attribute Histograms
//
//  Mount points:
//    #comparison-radar       — top panel (fingerprint radar)
//    #comparison-histogram   — bottom panel (small-multiple bar charts)
//    #comparison-container   — parent, receives the legend overlay
//
//  Public API (same shape as comparison.js):
//    initComparison()                        — call once after DOM ready
//    updateComparison(primary, compared)     — call on every city change
//    renderLegend()                          — call on every city change
//
//  Imports:
//    controls.js → getWeights(), ATTRIBUTES
//
//  Notes on normalization (radar):
//    Scores are normalized locally, i.e. min/max computed across the
//    currently selected cities only. This maximises visual spread and
//    makes the fingerprint shapes as distinct as possible. It means
//    "outer ring = best among selected cities", not best globally.
// ============================================================

import { getWeights, ATTRIBUTES } from './controls.js';


// ============================================================
//  STEP 1 — CONFIGURATION
// ============================================================

const CONFIG = {

  // -- Shared colors — index 0 = primary, 1–4 = compared ----
  CITY_COLORS: [
    '#ff6b35',   // primary
    '#ffd700',   // compared 1
    '#00bfff',   // compared 2
    '#7fff00',   // compared 3
    '#ff69b4',   // compared 4
  ],

  // -- Placeholder -----------------------------------------
  PLACEHOLDER_TEXT: 'Select at least 2 cities on the globe to compare',

  // -- Radar -----------------------------------------------
  RADAR_MARGIN: 36,          // px — breathing room around the radar circle
  RADAR_LEVELS: 4,           // number of concentric reference rings
  RADAR_FILL_OPACITY: 0.10,  // polygon fill transparency
  RADAR_STROKE_WIDTH: 1.5,   // polygon outline weight
  RADAR_DOT_RADIUS: 2.5,     // vertex dot radius
  RADAR_GRID_COLOR: 'rgba(255,255,255,0.10)',  // spokes + rings color

  // -- Histogram small multiples ---------------------------
  HIST_MARGIN: { top: 28, right: 10, bottom: 8, left: 38 },  // inner margins per cell
  HIST_COLS: 5,               // maximum columns in the small-multiples grid
  HIST_CELL_HEIGHT: 110,      // px — height of each mini bar chart cell
  HIST_BAR_PADDING: 0.18,     // D3 scaleBand inner padding between bars
  HIST_TICK_COUNT: 3,         // number of y-axis ticks per mini chart
  HIST_LABEL_SIZE: 9,         // px — attribute label font size
  HIST_TICK_SIZE: 8,          // px — tick label font size

};


// ============================================================
//  STEP 2 — MODULE STATE
// ============================================================

let _primary = null;  // primary city object (index 0 in allCities)
let _compared = [];    // array of compared city objects (index 1–4)


// ============================================================
//  STEP 3 — INITIALISE
//  Call once from main.js after the DOM is ready.
// ============================================================

export function initComparison() {
  _renderPlaceholder('comparison-radar');
  _renderPlaceholder('comparison-histogram');
}


// ============================================================
//  STEP 4 — PUBLIC UPDATE
//  Called by state.js whenever the city selection changes.
//    primary  — city object or null
//    compared — array of city objects (may be empty)
// ============================================================

export function updateComparison(primary, compared) {
  _primary = primary;
  _compared = compared ?? [];

  const allCities = _getAllCities();

  // Need at least 2 cities to render a meaningful comparison
  if (allCities.length < 2) {
    _renderPlaceholder('comparison-radar');
    _renderPlaceholder('comparison-histogram');
    return;
  }

  _renderRadar();
  _renderHistogram();
}


// ============================================================
//  STEP 5 — PLACEHOLDER
// ============================================================

function _renderPlaceholder(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';

  const msg = document.createElement('div');
  msg.className = 'comparison-placeholder';
  msg.textContent = CONFIG.PLACEHOLDER_TEXT;
  el.appendChild(msg);
}


// ============================================================
//  STEP 6 — FINGERPRINT RADAR
//
//  One semi-transparent polygon per city.
//  Axes = the currently selected attributes from controls.js.
//  No axis labels — the shape itself is the fingerprint.
//  Grid rings give a silent reference scale (0 %, 25 %, 50 %, 75 %, 100 %).
//
//  Normalization: local min/max across selected cities, per attribute.
//  Each city value is mapped to [0, 1] before plotting.
// ============================================================

function _renderRadar() {
  const container = document.getElementById('comparison-radar');
  if (!container) return;
  container.innerHTML = '';

  const weights = getWeights();

  // Need at least one attribute selected to draw any axis
  if (weights.length === 0) {
    _renderPlaceholder('comparison-radar');
    return;
  }

  const allCities = _getAllCities();
  const { width, height } = container.getBoundingClientRect();
  const size = Math.min(width, height);
  const margin = CONFIG.RADAR_MARGIN;
  const radius = size / 2 - margin;
  const cx = size / 2;
  const cy = size / 2;

  const n = weights.length;
  const slice = (2 * Math.PI) / n;

  // Angle for axis i — starts at the top (−π/2 = 12 o'clock)
  const angle = i => i * slice - Math.PI / 2;

  // Scale: normalized score (0–1) → radius in px
  const rScale = d3.scaleLinear()
    .domain([0, 1])
    .range([0, radius]);


  // -- Build SVG -------------------------------------------
  const svg = d3.select('#comparison-radar')
    .append('svg')
    .attr('width', size)
    .attr('height', size);

  // SVG filter: soft glow on city polygons
  const defs = svg.append('defs');
  const filter = defs.append('filter').attr('id', 'cv2-glow');
  filter.append('feGaussianBlur')
    .attr('stdDeviation', '3')
    .attr('result', 'blur');
  const feMerge = filter.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'blur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  const g = svg.append('g')
    .attr('transform', `translate(${cx},${cy})`);


  // -- 6a. Concentric grid rings (one per level) -----------
  for (let level = 1; level <= CONFIG.RADAR_LEVELS; level++) {
    const r = radius * (level / CONFIG.RADAR_LEVELS);

    // Build a polygon along the ring at radius r
    const ringPoints = d3.range(n).map(i => {
      const a = angle(i);
      return [r * Math.cos(a), r * Math.sin(a)];
    });

    g.append('polygon')
      .attr('points', ringPoints.map(p => p.join(',')).join(' '))
      .attr('fill', 'none')
      .attr('stroke', CONFIG.RADAR_GRID_COLOR)
      .attr('stroke-width', 0.5);
  }


  // -- 6b. Axis spokes (one line per attribute) ------------
  d3.range(n).forEach(i => {
    const a = angle(i);
    g.append('line')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', radius * Math.cos(a))
      .attr('y2', radius * Math.sin(a))
      .attr('stroke', CONFIG.RADAR_GRID_COLOR)
      .attr('stroke-width', 0.5);
  });


  // -- 6c. City polygons (one per city) --------------------
  allCities.forEach((city, ci) => {
    const color = CONFIG.CITY_COLORS[ci] ?? '#aaa';

    // For each axis, compute a locally normalized score (0–1)
    // and convert it into (x, y) coordinates
    const points = weights.map((w, i) => {
      const score = _getLocalNormalizedValue(city, w.attribute, allCities);
      const r = rScale(score);
      const a = angle(i);
      return [r * Math.cos(a), r * Math.sin(a)];
    });

    // Filled + outlined polygon
    g.append('polygon')
      .attr('points', points.map(p => p.join(',')).join(' '))
      .attr('fill', color)
      .attr('fill-opacity', CONFIG.RADAR_FILL_OPACITY)
      .attr('stroke', color)
      .attr('stroke-width', CONFIG.RADAR_STROKE_WIDTH)
      .attr('filter', 'url(#cv2-glow)');

    // Small dot at each axis vertex (aids reading individual values)
    weights.forEach((w, i) => {
      const score = _getLocalNormalizedValue(city, w.attribute, allCities);
      const r = rScale(score);
      const a = angle(i);

      g.append('circle')
        .attr('cx', r * Math.cos(a))
        .attr('cy', r * Math.sin(a))
        .attr('r', CONFIG.RADAR_DOT_RADIUS)
        .attr('fill', color);
    });
  });
}


// ============================================================
//  STEP 7 — PER-ATTRIBUTE HISTOGRAMS (small multiples)
//
//  One mini bar chart per selected attribute.
//  Bars are the selected cities; height = raw value of that city.
//  Each chart has its own independent y-scale (raw values differ
//  in unit and magnitude across attributes).
//  Attribute label sits above each chart as a title.
// ============================================================

function _renderHistogram() {
  const container = document.getElementById('comparison-histogram');
  if (!container) return;
  container.innerHTML = '';

  const weights = getWeights();

  // Need at least one attribute to render anything
  if (weights.length === 0) {
    _renderPlaceholder('comparison-histogram');
    return;
  }

  const allCities = _getAllCities();
  const m = CONFIG.HIST_MARGIN;

  // -- Grid layout -----------------------------------------
  // Spread charts across columns; wrap into rows as needed
  const cols = Math.min(CONFIG.HIST_COLS, weights.length);
  const containerW = container.getBoundingClientRect().width;
  const cellWidth = Math.floor(containerW / cols);
  const cellHeight = CONFIG.HIST_CELL_HEIGHT;
  const rows = Math.ceil(weights.length / cols);
  const totalHeight = rows * cellHeight;

  // Use relative positioning on the parent, absolute on each cell
  container.style.position = 'relative';
  container.style.height = totalHeight + 'px';


  // -- One mini chart per attribute ------------------------
  weights.forEach((w, attrIndex) => {

    // Determine cell position in the grid
    const col = attrIndex % cols;
    const row = Math.floor(attrIndex / cols);

    // Cell wrapper
    const cell = document.createElement('div');
    cell.className = 'hist-cell';
    cell.style.position = 'absolute';
    cell.style.left = (col * cellWidth) + 'px';
    cell.style.top = (row * cellHeight) + 'px';
    cell.style.width = cellWidth + 'px';
    cell.style.height = cellHeight + 'px';
    container.appendChild(cell);

    // Inner drawing area (minus margins)
    const W = cellWidth - m.left - m.right;
    const H = cellHeight - m.top - m.bottom;

    const svg = d3.select(cell)
      .append('svg')
      .attr('width', cellWidth)
      .attr('height', cellHeight);

    const g = svg.append('g')
      .attr('transform', `translate(${m.left},${m.top})`);


    // -- 7a. Attribute label (chart title) ---------------
    const label = _getLabelForAttribute(w.attribute);

    g.append('text')
      .attr('x', W / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', CONFIG.HIST_LABEL_SIZE)
      .attr('fill', 'rgba(255,255,255,0.55)')
      .text(label);


    // -- 7b. Scales --------------------------------------

    // x: one band per city (ordered: primary first, then compared)
    const xScale = d3.scaleBand()
      .domain(d3.range(allCities.length))
      .range([0, W])
      .padding(CONFIG.HIST_BAR_PADDING);

    // y: raw values — each chart has its own independent scale
    const rawValues = allCities.map(c => _getRawValue(c, w.attribute) ?? 0);
    const yMax = d3.max(rawValues) || 1;

    const yScale = d3.scaleLinear()
      .domain([0, yMax])
      .nice()
      .range([H, 0]);


    // -- 7c. Y axis (minimal: domain line removed) -------
    const yAxis = g.append('g')
      .call(
        d3.axisLeft(yScale)
          .ticks(CONFIG.HIST_TICK_COUNT)
          .tickSize(3)
      );

    // Style tick labels
    yAxis.selectAll('text')
      .attr('font-size', CONFIG.HIST_TICK_SIZE)
      .attr('fill', 'rgba(255,255,255,0.4)');

    // Style tick lines
    yAxis.selectAll('line')
      .attr('stroke', 'rgba(255,255,255,0.2)');

    // Remove the vertical domain bar (cleaner look)
    yAxis.select('.domain').remove();


    // -- 7d. Bars — one per city -------------------------
    allCities.forEach((city, ci) => {
      const val = _getRawValue(city, w.attribute) ?? 0;
      const color = CONFIG.CITY_COLORS[ci] ?? '#aaa';

      g.append('rect')
        .attr('x', xScale(ci))
        .attr('y', yScale(val))
        .attr('width', xScale.bandwidth())
        .attr('height', Math.max(0, H - yScale(val)))  // guard against negative height
        .attr('fill', color)
        .attr('opacity', 0.85);
    });
  });
}


// ============================================================
//  STEP 8 — LEGEND
//  Renders city name + color dot for each selected city.
//  Appended inside #comparison-container.
//  Any pre-existing legend is removed before redrawing.
// ============================================================

export function renderLegend() {

  // Remove old legend if present
  const existing = document.getElementById('comparison-legend');
  if (existing) existing.remove();

  const allCities = _getAllCities();
  if (allCities.length === 0) return;

  const legend = document.createElement('div');
  legend.id = 'comparison-legend';

  allCities.forEach((city, ci) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-dot"  style="background:${CONFIG.CITY_COLORS[ci]}"></span>
      <span class="legend-flag">${city.flag ?? ''}</span>
      <span class="legend-name">${city.city}</span>
    `;
    legend.appendChild(item);
  });

  const parent = document.getElementById('comparison-container');
  if (parent) parent.appendChild(legend);
}


// ============================================================
//  UTILITIES
// ============================================================

// Returns all selected cities in display order: primary first, then compared.
function _getAllCities() {
  if (!_primary) return [];
  return [_primary, ..._compared];
}


// Reads a value from a city object via dot-path notation.
// e.g. _getRawValue(city, 'cost_of_living') → 72.4
// e.g. _getRawValue(city, 'qol.safety_index') → 58.1
function _getRawValue(city, dotPath) {
  return dotPath.split('.').reduce(
    (acc, key) => (acc != null ? acc[key] : null),
    city
  );
}


// Normalizes a single city's value for one attribute to [0, 1],
// using min/max computed across the provided set of cities only.
//
// Why local (not global) normalization:
//   The comparison panel shows only the selected cities, so mapping
//   their range to the full [0, 1] axis makes differences maximally
//   readable. "Outer ring = best among selected cities."
//
// Edge cases:
//   - missing value  → 0
//   - all identical  → 0.5  (neutral mid-point, no information)
function _getLocalNormalizedValue(city, attribute, allCities) {
  // Collect non-null raw values across the comparison set
  const values = allCities
    .map(c => _getRawValue(c, attribute))
    .filter(v => v != null && !isNaN(v));

  if (values.length === 0) return 0;

  const min = d3.min(values);
  const max = d3.max(values);

  // All cities share the same value → neutral mid-point
  if (max === min) return 0.5;

  const val = _getRawValue(city, attribute);
  if (val == null || isNaN(val)) return 0;

  return (val - min) / (max - min);
}


// Returns the human-readable label for an attribute key,
// looking it up in the ATTRIBUTES list from controls.js.
// Falls back to the raw key if not found.
function _getLabelForAttribute(attribute) {
  return ATTRIBUTES.find(a => a.attribute === attribute)?.label ?? attribute;
}
