//  state.js: Central store, score engine, module connector
//  Imports:  globe.js (updateDotStyles)
//            controls.js (getWeights)

/*
1. Saves the cities scores
2. Saves the current selected cities (primary + compared)
3. Computes normalized scores according to weights
4. Notifies the map, city card and comparison modules
*/

/*
DUDAS:

- Deberia de llamar "initComparison(_metricStats);" desde el main.js

- Está bien que el state.js llame a funciones de otros módulos para actualizarse?

- Estoy llamando el updateDotSize() dos veces. Solo debería de dejar una verdad?

*/

import { updateDotsColor, updateDotSizes } from './globe.js';
import { getWeights, getSelectedAttributes } from './controls.js';

import { updateCityCard } from './cityCard.js';
import { initComparison, updateComparison, renderLegend } from './comparison.js';
import { barchart_render } from './barChart.js';
import { radar_render } from './radarChart.js';

// CONFIGURATION
const CONFIG = {
  MAX_COMPARED: 4,

  // Metrics where a LOWER value is better
  // These are inverted before normalization so that
  // after normalization, higher always = better
  INVERT_METRICS: new Set([
    'cost_of_living',
    'commute',
    'taxation',
    'mcmeal_combo',
    'internet_60mbps'
  ]),
  // contains the 'keys' of the attributes

};

// MODULE STATE
let _cities = [];             // full dataset (set once on init)
let _primaryCity = null;
let _comparedCities = [];

// Normalisation map (rebuilt whenever weights change)
let _scoreMap = new Map();  // city.city --> composite score (0–1)

// Min/max per metric key (computed once on init from full dataset)
let _metricStats = new Map();   // key → { min, max }


//  Computes metric stats across the full dataset once and stores them
export function initState(cities) {
  _cities = cities;
  _computeMetricStats();
  console.log('[state] initialised with', _cities.length, 'cities');
}

/* 
  Computes 'min' and 'max' for every numeric metric key across
  all cities (called once on init)
*/
function _computeMetricStats() {
  _metricStats.clear();

  // get all attributes keys that are numeric (of the first city only)
  const allKeys = _getAllMetricKeys();

  allKeys.forEach(attribute => {
    let min = Infinity;
    let max = -Infinity;

    _cities.forEach(city => {
      const val = _getNestedValue(city, attribute);
      if (val == null || isNaN(val)) return;
      if (val < min) min = val;
      if (val > max) max = val;
    });

    _metricStats.set(attribute, { min, max });
  });

  console.log('[state] metric stats computed for', _metricStats.size, 'metrics');
}


/*
  Computes a composite score (0–1) for a single city
  given the current weights from controls.js

  Pipeline per selected metric:
    1. Read raw value from city object via dot-path
    2. If metric is in INVERT_METRICS --> invert (max - val + min)
    3. Normalize to 0–1 using full-dataset min/max
    4. Multiply by weight
  Final score = sum of weighted normalized values / sum of weights
*/
function _computeScore(city, weights) {
  // if no weights selected, return 0 (lowest score)
  if (!weights || weights.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  weights.forEach(({ attribute, weight }) => {
    // Normalize to 0–1
    // we get the normalized value for this city and metric
    const normalized = _normalizeCityValue(city, attribute);

    // if normalized is null (e.g. missing data), we skip this metric for this city
    if (normalized == null) return;

    weightedSum += normalized * weight;
    totalWeight += weight;
  });

  // Compute final score as weighted average (0–1)
  return totalWeight === 0 ? 0 : weightedSum / totalWeight;
}

/*
  1. Recomputes scores for all cities and stores in _scoreMap
  2. Then, notifies globe to update dot sizes
  (called whenever weights change via 'onWeightsChange()')
*/
function _rebuildScoreMap() {
  // we get the new weights
  const weights = getWeights();

  // we clean the old map
  _scoreMap.clear();

  // for each city, we compute the new score and store it in the map
  _cities.forEach(currentCity => {
    const score = _computeScore(currentCity, weights);
    _scoreMap.set(currentCity.city, score);
  });

  console.log('[state] score map rebuilt');

  // notify 'globe' to update dot sizes based on new scores
  updateDotSizes(_scoreMap);
}


/* Called by globe.js and cityCard.js when a dot or header-name is clicked

  Logic:
    - Click selected primary     -->  deselect primary
    - Click selected comparison  -->  remove from comparison
    - Click any city, no primary -->  set as primary
    - Click any city, has primary, under limit --> add to comparison
    - Click any city, at limit   -->  warn, do nothing
*/
export function selectCity(city) {
  // Deselect primary
  if (_primaryCity?.city === city.city) { // is '_primaryCity' null? if not, compare city names
    _primaryCity = null;
    _notifyModules();
    return;
  }

  // Deselect from comparison
  const comparedIndex = _comparedCities.findIndex(comparedCity => comparedCity.city === city.city);
  if (comparedIndex !== -1) { // city is in the compared cities list
    _comparedCities.splice(comparedIndex, 1); // 'splice' modifies the original array, removing 1 element at 'comparedIndex'
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

// Converts the selected city as the primary city
export function setPrimaryCityFromHeader(clickedCity) {
  if (!_primaryCity || clickedCity.city === _primaryCity.city) return;

  // Save old primary city
  const oldPrimaryCity = _primaryCity;

  // Find clicked city index inside compared cities
  const clickedIndex = _comparedCities.findIndex(
    city => city.city === clickedCity.city
  );

  if (clickedIndex === -1) return;

  // Swap positions
  _comparedCities[clickedIndex] = oldPrimaryCity;
  _primaryCity = clickedCity;

  // Update city card, map colors, radar, etc.
  _notifyModules();
}

/*
  Controlled in the 'main' module, called whenever weights
  change in the controls module ('onWeightsChange' callback)
  Recomputes scores and notifies modules to update
*/
export function onWeightsChange() {
  _rebuildScoreMap();
  _notifyModules(); // we notify other modules for the visualization
  // updateDotSizes(_scoreMap);  // push new scores to the map so it can update dot sizes
}


/* 
  Notifies all modules to be updated with the current state:
  Single function that pushes current state to all modules
  Add new module calls here as each module is built
*/
function _notifyModules() {
  const weights = getWeights();
  // we compute the normalized scores for the primary city
  const scores = _getNormalizedScoresForCity(_primaryCity, weights);

  // Globe: update dot colours
  updateDotsColor(_primaryCity, _comparedCities);

  // ------ TODO: update comparison.js
  //updateComparison(_primaryCity, _comparedCities);

  // BarChart: update bar chart
  barchart_render(_cities, _getCurrentCities(), getSelectedAttributes());
  renderLegend();

  // update of cityCard.js
  updateCityCard(_primaryCity, _comparedCities, weights, scores);

  // Radar: update radar chart
  radar_render(_cities, _getCurrentCities());
}


/* 
  PUBLIC GETTERS, Read-only access to state
*/
export function getPrimaryCity() { return _primaryCity; }
export function getComparedCities() { return [..._comparedCities]; } // with '...' we return a new copy of the compared cities arrays
export function getAllCities() { return _cities; }
export function getScore(cityName) { return _scoreMap.get(cityName) ?? 0; }
export function getScoreMap() { return new Map(_scoreMap); }


/****************** HELPER FUNCTIONS *******************/


// Computes normalized scores for all metrics for a given city, based on current weights
function _getNormalizedScoresForCity(city, weights) {
  return new Map(
    weights.map(({ attribute }) => {
      // if no primary city or no stats for this metric, return 0
      if (!city) return [attribute, 0];

      // we get the min/max values
      const normalized = _normalizeCityValue(city, attribute);

      // if normalized is null (e.g. missing data), return 0
      return [attribute, normalized ?? 0];
    })
  );
}

// Normalizes a single metric value for a city based on min/max and inversion config
function _normalizeCityValue(city, attribute) {
  // we get the min/max values
  const stats = _metricStats.get(attribute);

  // if no stats for this metric, we skip (non-numerical/missing data)
  if (!stats) return null;

  let val = _getNestedValue(city, attribute);
  if (val == null || isNaN(val)) return null; // NaN/missing value

  const { min, max } = stats;
  // ALL cities IDENTICAL on this metric --> skip
  if (max === min) return null;

  // Invert if lower-is-better
  if (CONFIG.INVERT_METRICS.has(attribute)) {
    val = max - val + min;
    // e.g: if min = 10, max = 100, val = 30 
    // --> invertedVal = 100 - 30 + 10 = 80 (originally low, now high)
  }

  // Normalize to 0–1
  return (val - min) / (max - min);
  // e.g: if min = 10, max = 100, val = 30
  // --> normalizedVal = (30 - 10) / (100 - 10) = 20 / 90 = 0.22
}

// Reads a dot-path value from a nested object
// e.g: _getNestedValue(city, 'qol.safety_index') --> 75.4
function _getNestedValue(obj, dotPath) {
  return dotPath.split('.').reduce((acc, attribute) => {
    return acc != null ? acc[attribute] : null;
  }, obj);
}

// Returns dot-path strings for all numeric metric keys, by walking the first city object.
// dot-path example: 'qol.safety_index'
function _getAllMetricKeys() {
  // We assume all cities have the same structure
  if (_cities.length === 0) return [];
  const keys = [];

  // We walk the object tree and collect dot-paths for numeric values
  function walk(obj, prefix) {
    // For example, if prefix is 'qol' and attribute is 'safety_index', path becomes 'qol.safety_index'
    Object.entries(obj).forEach(([attribute, value]) => {
      // so path prefix is '' at the root, then 'qol', then 'qol.safety_index', etc
      const path = prefix ? `${prefix}.${attribute}` : attribute;
      if (typeof value === 'object' && value !== null) {
        walk(value, path);
      } else if (typeof value === 'number') {
        keys.push(path);
      }
    });
  }

  // Start walking from the first city object
  walk(_cities[0], '');   // walk means we traverse the object tree recursively, building dot-paths as we go, collecting keys for numeric values
  return keys;
}

function _getCurrentCities() {
  // Checks if there is a NULL city
  return [_primaryCity, ..._comparedCities]
    .filter(Boolean)
    .map(city => city.city);
}

/* Debugging metrics for weights and scores:

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
*/
