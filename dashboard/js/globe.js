// ============================================================
//  globe.js — Rotating D3 globe with city dots
//  Mounts into: #globe-container
//  Reads data from: data/cities.json
//  Depends on: d3 (loaded globally or as module)
// ============================================================

import { selectCity } from './state.js';

// ============================================================
//  STEP 1 — CONFIGURATION
//  Tweak these values without touching any rendering logic.
// ============================================================

const CONFIG = {

  // -- Dot appearance --------------------------------------
  DOT_RADIUS_DEFAULT: 4,        // px — fixed for now, will be replaced
  //      by a scale driven by composite score
  DOT_COLOR_DEFAULT: '#00bfff',  // placeholder — update with design token
  DOT_COLOR_SELECTED_PRIMARY: '#ff6b35',  // placeholder
  DOT_COLOR_SELECTED_COMPARISON: '#ffd700',  // placeholder
  DOT_OPACITY: 0.75,

  // -- Globe appearance ------------------------------------
  GLOBE_COLOR: '#1a1a2e',  // placeholder ocean color
  LAND_COLOR: '#2d4a3e',  // placeholder land color
  GRATICULE_COLOR: '#ffffff',  // placeholder grid lines
  GRATICULE_OPACITY: 0.08,

  // -- Rotation --------------------------------------------
  DRAG_SENSITIVITY: 0.4,       // lower = slower rotation on drag
  ROTATION_INERTIA: false,     // set true later if you want spin-on-release

  // -- Tooltip ---------------------------------------------
  TOOLTIP_DELAY_MS: 200,         // hover delay before tooltip appears
};


// ============================================================
//  STEP 2 — MODULE STATE
//  All mutable state lives here — nothing is stored on the DOM.
// ============================================================

let svg = null;   // the root SVG element
let projection = null;   // d3.geoOrthographic instance
let path = null;   // d3.geoPath bound to projection
let cities = [];     // full dataset loaded from cities.json

// Rotation state for drag
let isDragging = false;
let dragStartPos = [0, 0];
let rotationStart = [0, 0, 0];  // [lambda, phi, gamma]


// ============================================================
//  STEP 3 — INITIALISE
//  Call once from index.html after DOM is ready.
//  Loads data, builds the SVG, renders everything.
// ============================================================

export async function initGlobe() {

  const container = document.getElementById('globe-container');

  // -- 3a. Measure the container ---------------------------
  const { width, height } = container.getBoundingClientRect();
  const radius = Math.min(width, height) / 2 * 0.9;  // 90% of the shorter side

  // -- 3b. Create SVG --------------------------------------
  svg = d3.select('#globe-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // -- 3c. Set up projection -------------------------------
  projection = d3.geoOrthographic()
    .scale(radius)
    .translate([width / 2, height / 2])
    .clipAngle(90)          // hides geometry on the back of the globe
    .precision(0.5);

  path = d3.geoPath().projection(projection);

  // -- 3d. Load topojson / land data -----------------------
  // We need world land boundaries to draw the globe surface.
  // Using the standard cdn-hosted world-110m topojson.
  // TODO: replace with a local copy if working offline.
  const world = await d3.json(
    'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
  );
  const land = topojson.feature(world, world.objects.land);
  const graticule = d3.geoGraticule()();

  // -- 3e. Load city data ----------------------------------
  cities = await d3.json('data/cities.json');

  tooltip = d3.select('#globe-container')
    .append('div')
    .attr('id', 'globe-tooltip')
    .style('position', 'absolute')
    .style('pointer-events', 'none')
    .style('display', 'none');
  // All other styles (background, font, padding, etc.)
  // go in index.html under #globe-tooltip — do not hardcode here

  // -- 3f. Render all layers in order ----------------------
  renderGlobe(land, graticule);
  renderDots();

  // -- 3g. Attach drag behaviour ---------------------------
  attachDrag();

  // -- 3h. Respond to container resize ---------------------
  // TODO: wire up a ResizeObserver here when layout is finalised
}


// ============================================================
//  STEP 4 — RENDER HELPERS
//  Each function draws one layer. Re-called on rotation update.
// ============================================================

// Groups — created once, paths updated on every rotation
let gGlobe = null;
let gGraticule = null;
let gDots = null;

function renderGlobe(land, graticule) {

  // Sphere (ocean fill)
  gGlobe = svg.append('g').attr('class', 'g-globe');

  gGlobe.append('path')
    .datum({ type: 'Sphere' })
    .attr('class', 'sphere')
    .attr('d', path)
    .attr('fill', CONFIG.GLOBE_COLOR);

  // Graticule (grid lines)
  gGraticule = svg.append('g').attr('class', 'g-graticule');

  gGraticule.append('path')
    .datum(graticule)
    .attr('class', 'graticule')
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', CONFIG.GRATICULE_COLOR)
    .attr('stroke-opacity', CONFIG.GRATICULE_OPACITY)
    .attr('stroke-width', 0.5);

  // Land
  gGlobe.append('path')
    .datum(land)
    .attr('class', 'land')
    .attr('d', path)
    .attr('fill', CONFIG.LAND_COLOR);
}

function renderDots() {

  gDots = svg.append('g').attr('class', 'g-dots');

  gDots.selectAll('circle.city-dot')
    .data(cities, d => d.city)   // key by city name for stable updates
    .join('circle')
    .attr('class', 'city-dot')
    .attr('r', CONFIG.DOT_RADIUS_DEFAULT)
    .attr('fill', CONFIG.DOT_COLOR_DEFAULT)
    .attr('opacity', CONFIG.DOT_OPACITY)
    .attr('cx', d => projection([d.lon, d.lat])?.[0])
    .attr('cy', d => projection([d.lon, d.lat])?.[1])
    // Hide dots on the back of the globe
    .attr('visibility', d => isVisible(d) ? 'visible' : 'hidden')
    // TODO: attach click handler here (state.selectCity)
    .on('click', onDotClick)
    .on('mouseenter', (event, d) => {
      tooltipTimer = setTimeout(() => showTooltip(event, d), CONFIG.TOOLTIP_DELAY_MS);
    })
    .on('mouseleave', () => hideTooltip())
    .on('mousemove', (event, d) => {
      // Reposition if mouse moves while tooltip is visible
      if (tooltip.style('display') === 'block') {
        tooltip
          .style('left', (event.offsetX + 12) + 'px')
          .style('top', (event.offsetY - 12) + 'px');
      }
    });
}


// ============================================================
//  STEP 5 — ROTATION UPDATE
//  Called on every drag event. Re-projects all paths and dots.
// ============================================================

function updateRotation() {

  // Re-draw globe paths
  svg.selectAll('path').attr('d', path);

  // Re-position and show/hide dots
  gDots.selectAll('circle.city-dot')
    .attr('cx', d => projection([d.lon, d.lat])?.[0])
    .attr('cy', d => projection([d.lon, d.lat])?.[1])
    .attr('visibility', d => isVisible(d) ? 'visible' : 'hidden');
}


// ============================================================
//  STEP 6 — DRAG BEHAVIOUR
// ============================================================

function attachDrag() {

  svg.call(
    d3.drag()
      .on('start', (event) => {
        isDragging = true;
        dragStartPos = [event.x, event.y];
        rotationStart = [...projection.rotate()];
      })
      .on('drag', (event) => {
        if (!isDragging) return;

        const dx = (event.x - dragStartPos[0]) * CONFIG.DRAG_SENSITIVITY;
        const dy = (event.y - dragStartPos[1]) * CONFIG.DRAG_SENSITIVITY;

        projection.rotate([
          rotationStart[0] + dx,
          rotationStart[1] - dy,   // subtract: drag down = tilt north
          rotationStart[2]
        ]);

        updateRotation();
      })
      .on('end', () => {
        isDragging = false;
        // TODO: add inertia here if CONFIG.ROTATION_INERTIA is true
      })
  );
}


// ============================================================
//  STEP 7 — UTILITIES
// ============================================================

// Returns true if a city is on the visible hemisphere
function isVisible(d) {
  const p = projection([d.lon, d.lat]);
  if (!p) return false;
  // A point is visible if geoPath returns a defined value for it
  return path({ type: 'Point', coordinates: [d.lon, d.lat] }) !== null;
}


// ============================================================
//  STEP 7b — TOOLTIP
//  Appears after hovering a dot for TOOLTIP_DELAY_MS.
//  Customise appearance in #globe-tooltip CSS (index.html).
// ============================================================

let tooltipTimer = null;
let tooltip = null;

function showTooltip(event, d) {
  tooltip
    .style('display', 'block')
    .html(`
      <span class="tooltip-flag">${d.flag}</span>
      <span class="tooltip-city">${d.city}</span>
      <span class="tooltip-country">${d.country}</span>
      <span class="tooltip-hint">click for more info</span>
    `)
    .style('left', (event.offsetX + 12) + 'px')
    .style('top', (event.offsetY - 12) + 'px');
}

function hideTooltip() {
  clearTimeout(tooltipTimer);
  tooltip.style('display', 'none');
}

// ============================================================
//  STEP 8 — CLICK HANDLER (stub)
//  Will be wired to state.js once that module exists.
// ============================================================

function onDotClick(event, d) {
  event.stopPropagation();
  console.log('[globe] city clicked:', d.city);
  selectCity(d);
}


// ============================================================
//  STEP 9 — PUBLIC API
//  Functions exported for other modules to call.
// ============================================================

// Called by state.js when selection changes —
// updates dot colours without re-rendering the whole globe
export function updateDotStyles(primaryCity, comparedCities = []) {

  if (!gDots) return;

  const comparedNames = new Set(comparedCities.map(c => c.city));

  gDots.selectAll('circle.city-dot')
    .attr('fill', d => {
      if (d.city === primaryCity?.city) return CONFIG.DOT_COLOR_SELECTED_PRIMARY;
      if (comparedNames.has(d.city)) return CONFIG.DOT_COLOR_SELECTED_COMPARISON;
      return CONFIG.DOT_COLOR_DEFAULT;
    })
    .attr('r', d => {
      // Slightly enlarge selected dots — replace with score-driven scale later
      if (d.city === primaryCity?.city) return CONFIG.DOT_RADIUS_DEFAULT * 1.8;
      if (comparedNames.has(d.city)) return CONFIG.DOT_RADIUS_DEFAULT * 1.5;
      return CONFIG.DOT_RADIUS_DEFAULT;
    });
}
