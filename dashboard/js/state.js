// ============================================================
//  state.js — Central store, score engine, module connector
//  Imports:  globe.js (updateDotStyles)
//            controls.js (getWeights)
//  Called by: globe.js (selectCity), controls.js (onWeightsChange)
// ============================================================


// We want to do something like: ----> score = weightedNormalizedSum / totalWeight

// So that the map only read the city.score, and prints the dots with a size proportional to that score
// The score is computed in this module and whenever the weights change, we recompute the scores for all cities and update the map


import { updateDotStyles, updateDotSizes } from './globe.js';
import { getWeights } from './controls.js';
import { updateCityCard } from './cityCard.js';
import { initComparison, updateComparison, renderLegend } from './comparison.js';


// ============================================================
//  STEP 1 — CONFIGURATION
// ============================================================

const CONFIG = {

  MAX_COMPARED: 5,

  // Metrics where a LOWER value is better.
  // These are inverted before normalization so that
  // after normalization, higher always = better.
  INVERT_METRICS: new Set([
    'qol.cost_of_living_index',
    'qol.property_price_to_income_ratio',
    'qol.traffic_commute_time_index',
    'qol.pollution_index',
    'ua_scores.cost_of_living',
    'ua_scores.commute',
    'ua_scores.taxation',
    'cost_of_living_items.meal_inexpensive_restaurant_usd',
    'cost_of_living_items.monthly_transport_pass_usd',
    'cost_of_living_items.rent_1br_city_center_usd',
    'cost_of_living_items.groceries_index',
    'avg_temperature_c',
    'aqi',                    // lower AQI = cleaner air = better
    'numbeo_country.crime_index',
    'numbeo_country.pollution_index',
  ]),

};


// ============================================================
//  STEP 2 — MODULE STATE
//  Single source of truth for the entire application.
// ============================================================

let _cities = [];     // full dataset, set once on init
let _primaryCity = null;   // city object or null
let _comparedCities = [];     // array of city objects, max CONFIG.MAX_COMPARED

// Normalisation cache — rebuilt whenever weights change
// Map of city.city → composite score (0–1)
let _scoreCache = new Map();

// Min/max per metric key, computed once on init from full dataset
let _metricStats = new Map();   // key → { min, max }


// ============================================================
//  STEP 3 — INITIALISE
//  Call once after data is loaded, passing the full cities array.
//  Computes metric stats across the full dataset once and caches them.
// ============================================================

export function initState(cities) {
  _cities = cities;
  _computeMetricStats();
  initComparison(_metricStats);
  console.log('[state] initialised with', _cities.length, 'cities');
}


// ============================================================
//  STEP 4 — METRIC STATS
//  Computes min and max for every numeric metric key across
//  all cities. Called once on init — normalization reads from
//  this cache. Uses _getAllMetricKeys() to stay decoupled from
//  the controls attribute list.
// ============================================================

function _computeMetricStats() {
  _metricStats.clear();

  const allKeys = _getAllMetricKeys();

  allKeys.forEach(key => {
    let min = Infinity;
    let max = -Infinity;

    _cities.forEach(city => {
      const val = _getNestedValue(city, key);
      if (val == null || isNaN(val)) return;
      if (val < min) min = val;
      if (val > max) max = val;
    });

    _metricStats.set(key, { min, max });
  });

  console.log('[state] metric stats computed for', _metricStats.size, 'metrics');
}


// ============================================================
//  STEP 5 — SCORE ENGINE
//  Computes a composite score (0–1) for a single city
//  given the current weights from controls.js.
//
//  Pipeline per selected metric:
//    1. Read raw value from city object via dot-path
//    2. If metric is in INVERT_METRICS → invert (max - val + min)
//    3. Normalize to 0–1 using full-dataset min/max
//    4. Multiply by weight
//  Final score = sum of weighted normalized values / sum of weights
// ============================================================

function _computeScore(city, weights) {

  if (!weights || weights.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  weights.forEach(({ key, weight }) => {
    const stats = _metricStats.get(key);
    if (!stats) return;

    let val = _getNestedValue(city, key);
    if (val == null || isNaN(val)) return;

    const { min, max } = stats;
    if (max === min) return;   // all cities identical on this metric — skip

    // Invert if lower-is-better
    if (CONFIG.INVERT_METRICS.has(key)) {
      val = max - val + min;
    }

    // Normalize to 0–1
    const normalized = (val - min) / (max - min);

    weightedSum += normalized * weight;
    totalWeight += weight;
  });

  return totalWeight === 0 ? 0 : weightedSum / totalWeight;
}


// ============================================================
//  STEP 6 — SCORE CACHE
//  Recomputes scores for all cities and stores in _scoreCache.
//  Called whenever weights change via onWeightsChange().
//  After rebuilding, notifies globe to update dot sizes.
// ============================================================

function _rebuildScoreCache() {
  const weights = getWeights();
  _scoreCache.clear();

  _cities.forEach(city => {
    const score = _computeScore(city, weights);
    _scoreCache.set(city.city, score);
  });

  console.log('[state] score cache rebuilt');

  // TODO: notify globe to update dot sizes based on new scores
  // updateDotSizes(_scoreCache);   ← wire up when globe exposes this
}


// ============================================================
//  STEP 7 — CITY SELECTION
//  Called by globe.js when a dot is clicked.
//
//  Logic:
//    - Click selected primary     → deselect primary
//    - Click selected comparison  → remove from comparison
//    - Click any city, no primary → set as primary
//    - Click any city, has primary, under limit → add to comparison
//    - Click any city, at limit   → warn, do nothing
// ============================================================

export function selectCity(city) {

  // Deselect primary
  if (_primaryCity?.city === city.city) {
    _primaryCity = null;
    _notifyModules();
    return;
  }

  // Deselect from comparison
  const comparedIndex = _comparedCities.findIndex(c => c.city === city.city);
  if (comparedIndex !== -1) {
    _comparedCities.splice(comparedIndex, 1);
    _notifyModules();
    return;
  }

  // Set as primary
  if (_primaryCity === null) {
    _primaryCity = city;
    _notifyModules();
    return;
  }

  // Add to comparison
  if (_comparedCities.length < CONFIG.MAX_COMPARED) {
    _comparedCities.push(city);
    _notifyModules();
    return;
  }

  console.warn('[state] max compared cities reached —', CONFIG.MAX_COMPARED, 'max');
}


// ============================================================
//  STEP 8 — WEIGHTS CHANGE HANDLER
//  Called by controls.js whenever a slider moves or an
//  attribute is selected / deselected.
//  Rebuilds score cache and notifies globe of new dot sizes.
// ============================================================

export function onWeightsChange() {
  _rebuildScoreCache();
  updateDotSizes(_scoreCache);  // push new scores to the map so it can update dot sizes
}


// ============================================================
//  STEP 9 — NOTIFY MODULES
//  Single function that pushes current state to all modules.
//  Add new module calls here as each module is built.
// ============================================================

function _notifyModules() {

  // Globe: update dot colours
  updateDotStyles(_primaryCity, _comparedCities);

  updateComparison(_primaryCity, _comparedCities);
  renderLegend();

  const weights = getWeights();
  const scores = new Map(
    weights.map(({ key }) => {
      if (!_primaryCity) return [key, 0];
      const stats = _metricStats.get(key);
      if (!stats) return [key, 0];
      let val = _getNestedValue(_primaryCity, key);
      if (val == null || isNaN(val)) return [key, 0];
      const { min, max } = stats;
      if (max === min) return [key, 0];
      if (CONFIG.INVERT_METRICS.has(key)) val = max - val + min;
      return [key, (val - min) / (max - min)];
    })
  );
  updateCityCard(_primaryCity, weights, scores);

  console.log('[state] notified modules —',
    'primary:', _primaryCity?.city ?? 'none',
    '| compared:', _comparedCities.map(c => c.city).join(', ') || 'none'
  );
}


// ============================================================
//  STEP 10 — PUBLIC GETTERS
//  Read-only access to state for any module that needs it.
// ============================================================

export function getPrimaryCity() { return _primaryCity; }
export function getComparedCities() { return [..._comparedCities]; }
export function getAllCities() { return _cities; }
export function getScore(cityName) { return _scoreCache.get(cityName) ?? 0; }
export function getScoreCache() { return new Map(_scoreCache); }


// ============================================================
//  STEP 11 — UTILITIES
// ============================================================

// Reads a dot-path value from a nested object.
// e.g. _getNestedValue(city, 'qol.safety_index') → 75.4
function _getNestedValue(obj, dotPath) {
  return dotPath.split('.').reduce((acc, key) => {
    return acc != null ? acc[key] : null;
  }, obj);
}

// Derives all numeric metric keys by walking the first city object.
// Returns dot-path strings for numeric values only —
// skips strings (city, country, flag, english_proficiency_band).
function _getAllMetricKeys() {
  if (_cities.length === 0) return [];
  const keys = [];

  function walk(obj, prefix) {
    Object.entries(obj).forEach(([k, v]) => {
      const path = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null) {
        walk(v, path);
      } else if (typeof v === 'number') {
        keys.push(path);
      }
    });
  }

  walk(_cities[0], '');
  return keys;
}
