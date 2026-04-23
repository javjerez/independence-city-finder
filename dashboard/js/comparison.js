// ============================================================
//  comparison.js — Histogram + Radar comparison panel
//  Mounts into: #comparison-histogram, #comparison-radar
//  Called by:   state.js (updateComparison)
//  Depends on:  d3 (loaded globally)
// ============================================================

import { ATTRIBUTES } from './controls.js';


// ============================================================
//  STEP 1 — CONFIGURATION
// ============================================================

const CONFIG = {

  // -- Shared ----------------------------------------------
  MAX_ATTRIBUTES: 5,
  PLACEHOLDER_TEXT: 'Click more cities on the globe to compare',

  // -- City colors — index 0 = primary, 1–4 = compared ----
  // Placeholders — swap with design tokens later
  CITY_COLORS: [
    '#ff6b35',   // primary
    '#ffd700',   // compared 1
    '#00bfff',   // compared 2
    '#7fff00',   // compared 3
    '#ff69b4',   // compared 4
  ],

  // -- Histogram -------------------------------------------
  HIST_MARGIN: { top: 20, right: 16, bottom: 60, left: 48 },
  HIST_BAR_PADDING: 0.2,    // padding between attribute clusters
  HIST_INNER_PADDING: 0.08,   // padding between bars within a cluster

  // -- Radar -----------------------------------------------
  RADAR_MARGIN: 48,
  RADAR_LEVELS: 4,
  RADAR_FILL_OPACITY: 0.15,
  RADAR_STROKE_WIDTH: 2,
  RADAR_DOT_RADIUS: 3,
  RADAR_GRID_COLOR: '#ffffff',
  RADAR_GRID_OPACITY: 0.15,
  RADAR_LABEL_SIZE: 10,

  // -- Attribute picker ------------------------------------
  PICKER_PLACEHOLDER: '+ pick attribute',   // shown for empty slots

};


// ============================================================
//  STEP 2 — MODULE STATE
// ============================================================

let _primary = null;   // primary city object
let _compared = [];     // array of compared city objects
let _metricStats = null;   // Map key → { min, max } from state.js

// Independent attribute slot arrays — each slot is a key string or null
let _histAttrs = [null, null, null, null, null];   // histogram slots
let _radarAttrs = [null, null, null, null, null];   // radar slots

// Picker overlay state
let _activePicker = null;   // { panel: 'hist'|'radar', slotIndex, anchorEl }


// ============================================================
//  STEP 3 — INITIALISE
//  Call once from index.html after DOM is ready.
// ============================================================

export function initComparison(metricStats) {

  _metricStats = metricStats;

  _renderPlaceholder('comparison-histogram');
  _renderPlaceholder('comparison-radar');
}


// ============================================================
//  STEP 4 — PUBLIC UPDATE
//  Called by state.js whenever city selection changes.
// ============================================================

export function updateComparison(primary, compared) {
  _primary = primary;
  _compared = compared ?? [];

  const allCities = _getAllCities();

  if (allCities.length < 2) {
    _renderPlaceholder('comparison-histogram');
    _renderPlaceholder('comparison-radar');
    return;
  }

  _renderHistogram();
  _renderRadar();
}


// ============================================================
//  STEP 5 — PLACEHOLDER
// ============================================================

function _renderPlaceholder(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  const msg = document.createElement('div');
  msg.className = 'comparison-placeholder';
  msg.textContent = CONFIG.PLACEHOLDER_TEXT;
  el.appendChild(msg);
}


// ============================================================
//  STEP 6 — HISTOGRAM
//  One grouped bar cluster per attribute slot.
//  Clicking a cluster label opens the attribute picker.
// ============================================================

function _renderHistogram() {

  const container = document.getElementById('comparison-histogram');
  container.innerHTML = '';

  const allCities = _getAllCities();
  const m = CONFIG.HIST_MARGIN;
  const { width, height } = container.getBoundingClientRect();
  console.log('[comparison] histogram size:', width, height);


  const W = width - m.left - m.right;
  const H = height - m.top - m.bottom;

  const svg = d3.select('#comparison-histogram')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const g = svg.append('g')
    .attr('transform', `translate(${m.left},${m.top})`);

  // Active (non-null) attribute slots
  const activeAttrs = _histAttrs.map((key, i) => ({ key, slot: i }));

  // x0 — one band per attribute slot (including empty ones as placeholders)
  const x0 = d3.scaleBand()
    .domain(d3.range(CONFIG.MAX_ATTRIBUTES))
    .range([0, W])
    .padding(CONFIG.HIST_BAR_PADDING);

  // x1 — one band per city within each attribute cluster
  const x1 = d3.scaleBand()
    .domain(d3.range(allCities.length))
    .rangeRound([0, x0.bandwidth()])
    .padding(CONFIG.HIST_INNER_PADDING);

  // y — raw value scale, built per-render from active attrs
  const allValues = activeAttrs
    .filter(a => a.key)
    .flatMap(a => allCities.map(c => _getRawValue(c, a.key) ?? 0));

  const y = d3.scaleLinear()
    .domain([0, d3.max(allValues) || 1])
    .nice()
    .range([H, 0]);

  // -- Y axis ----------------------------------------------
  g.append('g')
    .call(d3.axisLeft(y).ticks(5))
    .attr('class', 'hist-axis');

  // -- Bar clusters ----------------------------------------
  const clusters = g.selectAll('.cluster')
    .data(activeAttrs)
    .join('g')
    .attr('class', 'cluster')
    .attr('transform', d => `translate(${x0(d.slot)}, 0)`);

  // Bars
  clusters.each(function (attrSlot) {
    const clusterG = d3.select(this);
    if (!attrSlot.key) return;

    allCities.forEach((city, ci) => {
      const val = _getRawValue(city, attrSlot.key) ?? 0;
      clusterG.append('rect')
        .attr('x', x1(ci))
        .attr('y', y(val))
        .attr('width', x1.bandwidth())
        .attr('height', H - y(val))
        .attr('fill', CONFIG.CITY_COLORS[ci] ?? '#aaa')
        .attr('opacity', 0.85);
    });
  });

  // -- Slot labels (clickable — open picker) ---------------
  clusters.append('text')
    .attr('class', 'hist-slot-label')
    .attr('x', x0.bandwidth() / 2)
    .attr('y', H + 16)
    .attr('text-anchor', 'middle')
    .attr('font-size', CONFIG.RADAR_LABEL_SIZE)
    .attr('cursor', 'pointer')
    .text(d => d.key ? _shortLabel(_getLabelForKey(d.key)) : CONFIG.PICKER_PLACEHOLDER)
    .on('click', function (event, d) {
      _openPicker('hist', d.slot, this, event);
    });
}


// ============================================================
//  STEP 7 — RADAR
//  One polygon per city, 5 axes (slots).
//  Clicking an axis label opens the attribute picker.
// ============================================================

function _renderRadar() {

  const container = document.getElementById('comparison-radar');
  container.innerHTML = '';

  const allCities = _getAllCities();
  const { width, height } = container.getBoundingClientRect();
  const size = Math.min(width, height);
  const margin = CONFIG.RADAR_MARGIN;
  const radius = size / 2 - margin;
  const cx = size / 2;
  const cy = size / 2;
  const n = CONFIG.MAX_ATTRIBUTES;
  const slice = (2 * Math.PI) / n;
  const angle = i => i * slice - Math.PI / 2;

  const rScale = d3.scaleLinear().domain([0, 1]).range([0, radius]);

  const svg = d3.select('#comparison-radar')
    .append('svg')
    .attr('width', size)
    .attr('height', size);

  const g = svg.append('g')
    .attr('transform', `translate(${cx},${cy})`);

  // -- Grid rings ------------------------------------------
  for (let level = 1; level <= CONFIG.RADAR_LEVELS; level++) {
    const r = radius * (level / CONFIG.RADAR_LEVELS);
    const points = d3.range(n).map(i => {
      const a = angle(i);
      return [r * Math.cos(a), r * Math.sin(a)];
    });
    g.append('polygon')
      .attr('points', points.map(p => p.join(',')).join(' '))
      .attr('fill', 'none')
      .attr('stroke', CONFIG.RADAR_GRID_COLOR)
      .attr('stroke-opacity', CONFIG.RADAR_GRID_OPACITY)
      .attr('stroke-width', 0.5);
  }

  // -- Axis spokes -----------------------------------------
  d3.range(n).forEach(i => {
    const a = angle(i);
    g.append('line')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', radius * Math.cos(a))
      .attr('y2', radius * Math.sin(a))
      .attr('stroke', CONFIG.RADAR_GRID_COLOR)
      .attr('stroke-opacity', CONFIG.RADAR_GRID_OPACITY)
      .attr('stroke-width', 0.5);
  });

  // -- Axis labels (clickable) -----------------------------
  const labelRadius = radius + 16;

  d3.range(n).forEach(i => {
    const a = angle(i);
    const x = labelRadius * Math.cos(a);
    const y = labelRadius * Math.sin(a);
    const key = _radarAttrs[i];
    const anchor = Math.cos(a) > 0.1 ? 'start'
      : Math.cos(a) < -0.1 ? 'end'
        : 'middle';

    g.append('text')
      .attr('x', x)
      .attr('y', y)
      .attr('text-anchor', anchor)
      .attr('dominant-baseline', 'middle')
      .attr('font-size', CONFIG.RADAR_LABEL_SIZE)
      .attr('cursor', 'pointer')
      .text(key ? _shortLabel(_getLabelForKey(key)) : CONFIG.PICKER_PLACEHOLDER)
      .on('click', function (event) {
        _openPicker('radar', i, this, event);
      });
  });

  // -- City polygons ---------------------------------------
  allCities.forEach((city, ci) => {
    const points = d3.range(n).map(i => {
      const key = _radarAttrs[i];
      const score = key ? _getNormalizedValue(city, key) : 0;
      const r = rScale(score);
      const a = angle(i);
      return [r * Math.cos(a), r * Math.sin(a)];
    });

    g.append('polygon')
      .attr('points', points.map(p => p.join(',')).join(' '))
      .attr('fill', CONFIG.CITY_COLORS[ci] ?? '#aaa')
      .attr('fill-opacity', CONFIG.RADAR_FILL_OPACITY)
      .attr('stroke', CONFIG.CITY_COLORS[ci] ?? '#aaa')
      .attr('stroke-width', CONFIG.RADAR_STROKE_WIDTH);

    // Dots at each axis
    d3.range(n).forEach(i => {
      const key = _radarAttrs[i];
      const score = key ? _getNormalizedValue(city, key) : 0;
      const r = rScale(score);
      const a = angle(i);
      g.append('circle')
        .attr('cx', r * Math.cos(a))
        .attr('cy', r * Math.sin(a))
        .attr('r', CONFIG.RADAR_DOT_RADIUS)
        .attr('fill', CONFIG.CITY_COLORS[ci] ?? '#aaa');
    });
  });
}


// ============================================================
//  STEP 8 — LEGEND
//  Shows city name + color for each city in the comparison.
//  Appended below both plots via a shared overlay div.
// ============================================================

export function renderLegend() {

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
      <span class="legend-dot" style="background:${CONFIG.CITY_COLORS[ci]}"></span>
      <span class="legend-flag">${city.flag ?? ''}</span>
      <span class="legend-name">${city.city}</span>
    `;
    legend.appendChild(item);
  });

  document.getElementById('comparison-container').appendChild(legend);
}


// ============================================================
//  STEP 9 — ATTRIBUTE PICKER
//  A floating list of all ATTRIBUTES.
//  Opens anchored to the clicked label.
//  Clicking an attribute assigns it to the slot and re-renders.
// ============================================================

function _openPicker(panel, slotIndex, anchorEl, event) {

  event.stopPropagation();

  // Close any existing picker
  _closePicker();

  _activePicker = { panel, slotIndex };

  // -- Build picker overlay --------------------------------
  const picker = document.createElement('div');
  picker.id = 'attr-picker';

  // Position near the clicked label
  const rect = anchorEl.getBoundingClientRect();
  picker.style.position = 'fixed';
  picker.style.top = (rect.bottom + 4) + 'px';
  picker.style.left = rect.left + 'px';
  picker.style.zIndex = '999';

  // -- Search input ----------------------------------------
  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = 'Search…';
  search.id = 'attr-picker-search';
  picker.appendChild(search);

  // -- Attribute list --------------------------------------
  const list = document.createElement('ul');
  list.id = 'attr-picker-list';
  picker.appendChild(list);

  function populateList(filter) {
    list.innerHTML = '';
    const filtered = ATTRIBUTES.filter(a =>
      a.label.toLowerCase().includes(filter.toLowerCase())
    );
    filtered.forEach(attr => {
      const li = document.createElement('li');
      li.textContent = attr.label;
      li.className = 'attr-picker-item';
      li.dataset.key = attr.key;
      li.addEventListener('click', () => {
        _assignAttribute(panel, slotIndex, attr.key);
        _closePicker();
      });
      list.appendChild(li);
    });
  }

  populateList('');
  search.addEventListener('input', e => populateList(e.target.value));

  document.body.appendChild(picker);

  // Focus search immediately
  setTimeout(() => search.focus(), 0);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', _closePicker, { once: true });
  }, 0);
}

function _closePicker() {
  const existing = document.getElementById('attr-picker');
  if (existing) existing.remove();
  _activePicker = null;
}

function _assignAttribute(panel, slotIndex, key) {
  if (panel === 'hist') _histAttrs[slotIndex] = key;
  if (panel === 'radar') _radarAttrs[slotIndex] = key;
  _renderHistogram();
  _renderRadar();
  renderLegend();
}


// ============================================================
//  STEP 10 — UTILITIES
// ============================================================

// All cities in order: primary first, then compared
function _getAllCities() {
  if (!_primary) return [];
  return [_primary, ..._compared];
}

// Read raw value from city via dot-path
function _getRawValue(city, dotPath) {
  return dotPath.split('.').reduce((acc, k) => acc != null ? acc[k] : null, city);
}

// Normalized 0–1 value using metricStats from state.js
function _getNormalizedValue(city, key) {
  if (!_metricStats) return 0;
  const stats = _metricStats.get(key);
  if (!stats) return 0;
  let val = _getRawValue(city, key);
  if (val == null || isNaN(val)) return 0;
  const { min, max } = stats;
  if (max === min) return 0;
  return (val - min) / (max - min);
}

// Get human-readable label for a key from ATTRIBUTES list
function _getLabelForKey(key) {
  return ATTRIBUTES.find(a => a.key === key)?.label ?? key;
}

// Truncate long labels
function _shortLabel(label) {
  return label.length > 14 ? label.slice(0, 13) + '…' : label;
}
