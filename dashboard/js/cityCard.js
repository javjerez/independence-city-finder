// ============================================================
//  cityCard.js — City card with D3 radar plot
//  Mounts into: #city-card-container
//  Called by:   state.js (updateCityCard)
//  Depends on:  d3 (loaded globally)
// ============================================================


// ============================================================
//  STEP 1 — CONFIGURATION
// ============================================================

const CONFIG = {

  // -- Layout ----------------------------------------------
  INFO_WIDTH_PERCENT: 35,     // % of card width given to left info panel
  // radar takes the remaining %

  // -- Radar geometry --------------------------------------
  RADAR_MARGIN: 40,     // px — space around the radar for axis labels
  RADAR_LEVELS: 4,      // number of concentric rings
  RADAR_MAX_VALUE: 1,      // normalized scores are always 0–1

  // -- Radar appearance ------------------------------------
  RADAR_COLOR: '#00bfff',   // placeholder — swap with var(--color-accent)
  RADAR_FILL_OPACITY: 0.25,
  RADAR_STROKE_WIDTH: 2,
  RADAR_DOT_RADIUS: 4,

  RADAR_GRID_COLOR: '#ffffff',   // placeholder
  RADAR_GRID_OPACITY: 0.15,

  RADAR_LABEL_SIZE: 11,          // px — axis label font size
  // auto-reduces when many attributes shown

  // -- Placeholder -----------------------------------------
  PLACEHOLDER_TEXT: 'Click a city on the globe to explore its data',

};


// ============================================================
//  STEP 2 — MODULE STATE
// ============================================================

let _city = null;    // current city object from state.js
let _weights = [];      // current weights array [{ key, weight }]
let _scores = new Map(); // key → normalized score (0–1) for current city

let _svg = null;    // radar SVG selection
let _radarGroup = null;   // g element inside SVG for the radar


// ============================================================
//  STEP 3 — INITIALISE
//  Call once from index.html after DOM is ready.
//  Renders the empty / placeholder state.
// ============================================================

export function initCityCard() {

  const container = document.getElementById('city-card-container');
  container.innerHTML = '';

  // -- 3a. Outer wrapper -----------------------------------
  const wrapper = document.createElement('div');
  wrapper.id = 'city-card-wrapper';
  container.appendChild(wrapper);

  // -- 3b. Left info panel ---------------------------------
  const infoPanel = document.createElement('div');
  infoPanel.id = 'city-card-info';
  wrapper.appendChild(infoPanel);

  // City identity block
  const identity = document.createElement('div');
  identity.id = 'city-card-identity';
  identity.innerHTML = `
    <span id="city-card-flag"></span>
    <span id="city-card-name">—</span>
    <span id="city-card-country"></span>
  `;
  infoPanel.appendChild(identity);

  // --------------------------------------------------------
  // RESERVED SPACE — left info panel extra content
  // This section is intentionally left blank.
  // Add additional city info elements here when ready
  // (e.g. composite score badge, rank, quick stats, etc.)
  // --------------------------------------------------------
  const reserved = document.createElement('div');
  reserved.id = 'city-card-reserved';
  reserved.textContent = 'Provisional space';
  infoPanel.appendChild(reserved);

  // -- 3c. Radar panel -------------------------------------
  const radarPanel = document.createElement('div');
  radarPanel.id = 'city-card-radar';
  wrapper.appendChild(radarPanel);

  // -- 3d. Render placeholder ------------------------------
  _renderPlaceholder(radarPanel);
}


// ============================================================
//  STEP 4 — PUBLIC UPDATE
//  Called by state.js whenever the primary city or weights change.
//  city    — city object or null
//  weights — array of { key, weight, label } from controls.js
//  scores  — Map of key → normalized score (0–1) for this city
// ============================================================

export function updateCityCard(city, weights, scores) {
  _city = city;
  _weights = weights ?? [];
  _scores = scores ?? new Map();

  _renderIdentity();
  _renderRadar();
}


// ============================================================
//  STEP 5 — IDENTITY RENDER
//  Updates the left panel text fields.
// ============================================================

function _renderIdentity() {

  document.getElementById('city-card-flag').textContent = _city?.flag ?? '';
  document.getElementById('city-card-name').textContent = _city?.city ?? '—';
  document.getElementById('city-card-country').textContent = _city?.country ?? '';
}


// ============================================================
//  STEP 6 — RADAR RENDER
//  Clears and redraws the radar every time city or weights change.
//  Handles 1–5 attributes gracefully — axes auto-space.
// ============================================================

function _renderRadar() {

  const panel = document.getElementById('city-card-radar');
  panel.innerHTML = '';   // clear previous SVG

  // -- No city selected ------------------------------------
  if (!_city) {
    _renderPlaceholder(panel);
    return;
  }

  // -- No attributes selected ------------------------------
  if (_weights.length === 0) {
    const msg = document.createElement('div');
    msg.id = 'city-card-no-attrs';
    msg.textContent = 'Select attributes in the control panel to see scores';
    panel.appendChild(msg);
    return;
  }

  // -- Measure available space -----------------------------
  const { width, height } = panel.getBoundingClientRect();
  const size = Math.min(width, height);
  const margin = CONFIG.RADAR_MARGIN;
  const radius = size / 2 - margin;
  const cx = size / 2;
  const cy = size / 2;

  // -- Build SVG -------------------------------------------
  _svg = d3.select('#city-card-radar')
    .append('svg')
    .attr('width', size)
    .attr('height', size);

  _radarGroup = _svg.append('g')
    .attr('transform', `translate(${cx}, ${cy})`);

  const n = _weights.length;
  const slice = (2 * Math.PI) / n;

  // Angle for axis i — start at top (−π/2)
  const angle = i => i * slice - Math.PI / 2;

  // Scale: normalized score (0–1) → radius in px
  const rScale = d3.scaleLinear()
    .domain([0, CONFIG.RADAR_MAX_VALUE])
    .range([0, radius]);

  // -- 6a. Concentric grid rings ---------------------------
  _renderGridRings(radius, n, angle, rScale);

  // -- 6b. Axis spokes -------------------------------------
  _renderAxes(radius, n, angle);

  // -- 6c. Axis labels -------------------------------------
  _renderLabels(radius, n, angle);

  // -- 6d. Data polygon ------------------------------------
  _renderPolygon(n, angle, rScale);

  // -- 6e. Data dots ---------------------------------------
  _renderDots(n, angle, rScale);
}


// ============================================================
//  STEP 7 — RADAR SUB-RENDERERS
// ============================================================

function _renderGridRings(radius, n, angle, rScale) {

  const levels = CONFIG.RADAR_LEVELS;

  for (let level = 1; level <= levels; level++) {

    const r = radius * (level / levels);

    // Build ring polygon points
    const points = d3.range(n).map(i => {
      const a = angle(i);
      return [r * Math.cos(a), r * Math.sin(a)];
    });

    _radarGroup.append('polygon')
      .attr('points', points.map(p => p.join(',')).join(' '))
      .attr('fill', 'none')
      .attr('stroke', CONFIG.RADAR_GRID_COLOR)
      .attr('stroke-opacity', CONFIG.RADAR_GRID_OPACITY)
      .attr('stroke-width', 0.5);
  }
}

function _renderAxes(radius, n, angle) {

  d3.range(n).forEach(i => {
    const a = angle(i);
    const x2 = radius * Math.cos(a);
    const y2 = radius * Math.sin(a);

    _radarGroup.append('line')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', x2).attr('y2', y2)
      .attr('stroke', CONFIG.RADAR_GRID_COLOR)
      .attr('stroke-opacity', CONFIG.RADAR_GRID_OPACITY)
      .attr('stroke-width', 0.5);
  });
}

function _renderLabels(radius, n, angle) {

  // Shrink font for many attributes
  const fontSize = n <= 3
    ? CONFIG.RADAR_LABEL_SIZE
    : Math.max(8, CONFIG.RADAR_LABEL_SIZE - (n - 3));

  const labelRadius = radius + 16;   // px beyond the outer ring

  _weights.forEach((attr, i) => {
    const a = angle(i);
    const x = labelRadius * Math.cos(a);
    const y = labelRadius * Math.sin(a);

    // Anchor: left/right based on position
    const anchor = Math.cos(a) > 0.1 ? 'start'
      : Math.cos(a) < -0.1 ? 'end'
        : 'middle';

    _radarGroup.append('text')
      .attr('x', x)
      .attr('y', y)
      .attr('text-anchor', anchor)
      .attr('dominant-baseline', 'middle')
      .attr('font-size', fontSize)
      // color: var(--color-text-primary) — set via CSS once tokens defined
      .text(_shortLabel(attr.label ?? attr.key));
  });
}

function _renderPolygon(n, angle, rScale) {

  const points = _weights.map((attr, i) => {
    const score = _scores.get(attr.key) ?? 0;
    const r = rScale(score);
    const a = angle(i);
    return [r * Math.cos(a), r * Math.sin(a)];
  });

  _radarGroup.append('polygon')
    .attr('points', points.map(p => p.join(',')).join(' '))
    .attr('fill', CONFIG.RADAR_COLOR)
    .attr('fill-opacity', CONFIG.RADAR_FILL_OPACITY)
    .attr('stroke', CONFIG.RADAR_COLOR)
    .attr('stroke-width', CONFIG.RADAR_STROKE_WIDTH);
}

function _renderDots(n, angle, rScale) {

  _weights.forEach((attr, i) => {
    const score = _scores.get(attr.key) ?? 0;
    const r = rScale(score);
    const a = angle(i);

    _radarGroup.append('circle')
      .attr('cx', r * Math.cos(a))
      .attr('cy', r * Math.sin(a))
      .attr('r', CONFIG.RADAR_DOT_RADIUS)
      .attr('fill', CONFIG.RADAR_COLOR);
  });
}


// ============================================================
//  STEP 8 — PLACEHOLDER
// ============================================================

function _renderPlaceholder(container) {
  const el = document.createElement('div');
  el.id = 'city-card-placeholder';
  el.textContent = CONFIG.PLACEHOLDER_TEXT;
  container.appendChild(el);
}


// ============================================================
//  STEP 9 — UTILITIES
// ============================================================

// Truncates long labels for the radar axes
function _shortLabel(label) {
  return label.length > 14 ? label.slice(0, 13) + '…' : label;
}
