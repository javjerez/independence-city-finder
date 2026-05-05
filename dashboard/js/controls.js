
// GENERAL INFO
//  controls.js -->  Attribute selector + weight sliders
//  Mounts into --> #controls-container
//  Exports     --> getWeights(), called by state.js


// *** CONFIGURATION ***

const CONFIG = {
  MAX_SELECTED: 5,      // max attributes selectable at once
  SLIDER_MIN: 1,        // min weight value
  SLIDER_MAX: 5,        // max weight value  ← adjust here
  SLIDER_STEP: 1,       // step increment
  SLIDER_DEFAULT: 3,    // weight when an attribute is first selected

  // Grid layout
  GRID_COLUMNS: 3,      // number of columns in the attribute grid
  
  // <--- adjust here when panel width is finalised

};

// *** ATTRIBUTE DEFINITIONS *** (All numeric metrics from cities.json, grouped by source)

/*
'key': it is the dot-path used to read the value from a city object
'label': it is what appears in the UI box
'group': groups attributes (for future filtering or styling)
*/

export const ATTRIBUTES = [

  // Quality of Life (Numbeo)
  { key: 'qol.quality_of_life_index', group: 'QoL', label: 'Quality of Life' },
  { key: 'qol.purchasing_power_index', group: 'QoL', label: 'Purchasing Power' },
  { key: 'qol.safety_index', group: 'QoL', label: 'Safety (QoL)' },
  { key: 'qol.healthcare_index', group: 'QoL', label: 'Healthcare (QoL)' },
  { key: 'qol.cost_of_living_index', group: 'QoL', label: 'Cost of Living (QoL)' },
  { key: 'qol.property_price_to_income_ratio', group: 'QoL', label: 'Property/Income Ratio' },
  { key: 'qol.traffic_commute_time_index', group: 'QoL', label: 'Commute Time' },
  { key: 'qol.pollution_index', group: 'QoL', label: 'Pollution (QoL)' },
  { key: 'qol.climate_index', group: 'QoL', label: 'Climate (QoL)' },

  // Urban Area Scores
  { key: 'ua_scores.housing', group: 'Urban', label: 'Housing' },
  { key: 'ua_scores.cost_of_living', group: 'Urban', label: 'Cost of Living (UA)' },
  { key: 'ua_scores.startups', group: 'Urban', label: 'Startups' },
  { key: 'ua_scores.venture_capital', group: 'Urban', label: 'Venture Capital' },
  { key: 'ua_scores.travel_connectivity', group: 'Urban', label: 'Travel Connectivity' },
  { key: 'ua_scores.commute', group: 'Urban', label: 'Commute (UA)' },
  { key: 'ua_scores.business_freedom', group: 'Urban', label: 'Business Freedom' },
  { key: 'ua_scores.safety', group: 'Urban', label: 'Safety (UA)' },
  { key: 'ua_scores.healthcare', group: 'Urban', label: 'Healthcare (UA)' },
  { key: 'ua_scores.education', group: 'Urban', label: 'Education' },
  { key: 'ua_scores.environmental_quality', group: 'Urban', label: 'Environment' },
  { key: 'ua_scores.economy', group: 'Urban', label: 'Economy' },
  { key: 'ua_scores.taxation', group: 'Urban', label: 'Taxation' },
  { key: 'ua_scores.internet_access', group: 'Urban', label: 'Internet Access (UA)' },
  { key: 'ua_scores.leisure_culture', group: 'Urban', label: 'Leisure & Culture' },
  { key: 'ua_scores.tolerance', group: 'Urban', label: 'Tolerance' },
  { key: 'ua_scores.outdoors', group: 'Urban', label: 'Outdoors' },

  // Salary & Cost
  { key: 'salary.avg_monthly_net_usd', group: 'Economy', label: 'Avg Net Salary' },
  { key: 'cost_of_living_items.meal_inexpensive_restaurant_usd', group: 'Economy', label: 'Meal (cheap)' },
  { key: 'cost_of_living_items.monthly_transport_pass_usd', group: 'Economy', label: 'Transport Pass' },
  { key: 'cost_of_living_items.rent_1br_city_center_usd', group: 'Economy', label: 'Rent 1BR (center)' },
  { key: 'cost_of_living_items.groceries_index', group: 'Economy', label: 'Groceries Index' },

  // Happiness
  { key: 'happiness.ladder_score', group: 'Happiness', label: 'Happiness Score' },
  { key: 'happiness.freedom_score', group: 'Happiness', label: 'Freedom' },
  { key: 'happiness.social_support', group: 'Happiness', label: 'Social Support' },
  { key: 'happiness.healthy_life_expectancy', group: 'Happiness', label: 'Life Expectancy' },

  // Environment & Infrastructure
  { key: 'sunshine.annual_hours', group: 'Environment', label: 'Sunshine Hours' },
  { key: 'avg_temperature_c', group: 'Environment', label: 'Avg Temperature' },
  { key: 'internet_speed_mbps', group: 'Environment', label: 'Internet Speed' },
  { key: 'aqi', group: 'Environment', label: 'Air Quality (AQI)' },

  // Society
  { key: 'lgbtq_legal_index', group: 'Society', label: 'LGBTQ+ Legal Index' },
  { key: 'english_proficiency_score', group: 'Society', label: 'English Proficiency' },

  // Numbeo Country
  { key: 'numbeo_country.healthcare_index', group: 'Country', label: 'Healthcare (Country)' },
  { key: 'numbeo_country.crime_index', group: 'Country', label: 'Crime (Country)' },
  { key: 'numbeo_country.safety_index', group: 'Country', label: 'Safety (Country)' },
  { key: 'numbeo_country.pollution_index', group: 'Country', label: 'Pollution (Country)' },

];


// *** MODULE STATE *** 

const selected = new Set();  // selected: Set of attribute-keys currently active
const weights = new Map();   // weights:  Map of key ..> slider value (only for selected keys)


// *** INITIALISE *** (call once from index.html after DOM is ready)

export function initControls() {

  const container = document.getElementById('controls-container');
  container.innerHTML = '';   // clear any previous content

  // -- 4a. Wrapper -----------------------------------------
  const wrapper = document.createElement('div');
  wrapper.id = 'controls-wrapper';
  container.appendChild(wrapper);

  // -- 4b. Header ------------------------------------------
  const header = document.createElement('div');
  header.id = 'controls-header';
  header.innerHTML = `
    <span id="controls-title">Attributes</span>
    <span id="controls-count">0 / ${CONFIG.MAX_SELECTED} selected</span>
  `;
  wrapper.appendChild(header);

  // -- 4c. Attribute grid ----------------------------------
  const grid = document.createElement('div');
  grid.id = 'controls-grid';
  grid.style.gridTemplateColumns = `repeat(${CONFIG.GRID_COLUMNS}, 1fr)`;
  wrapper.appendChild(grid);

  ATTRIBUTES.forEach(attr => {
    const box = document.createElement('button');
    box.classList.add('attr-box');
    box.dataset.key = attr.key;
    box.textContent = attr.label;
    box.title = attr.key;   // full key visible on hover for debugging
    box.addEventListener('click', () => onBoxClick(attr.key));
    grid.appendChild(box);
  });

  // -- 4d. Sliders container -------------------------------
  const slidersContainer = document.createElement('div');
  slidersContainer.id = 'controls-sliders';
  wrapper.appendChild(slidersContainer);

}


// *** INTERACTION HANDLERS *** 

function onBoxClick(key) {

  if (selected.has(key)) {
    // Deselect — remove from state, reset weight, remove slider
    selected.delete(key);
    weights.delete(key);
    removeSlider(key);

  } else {
    // Reject if already at max
    if (selected.size >= CONFIG.MAX_SELECTED) return;

    // Select — add to state with default weight, add slider
    selected.add(key);
    weights.set(key, CONFIG.SLIDER_DEFAULT);
    addSlider(key);
  }

  // Update box highlight
  const box = document.querySelector(`.attr-box[data-key="${key}"]`);
  if (box) box.classList.toggle('attr-box--selected', selected.has(key));

  // Update counter
  updateCounter();

  // TODO: notify state.js that weights changed
  // state.onWeightsChange(getWeights());
}


// *** SLIDER MANAGEMENT ***

function addSlider(key) {

  const attr = ATTRIBUTES.find(a => a.key === key);
  const container = document.getElementById('controls-sliders');

  const row = document.createElement('div');
  row.classList.add('slider-row');
  row.dataset.key = key;

  row.innerHTML = `
    <label class="slider-label">${attr.label}</label>
    <div class="slider-track">
      <span class="slider-bound">${CONFIG.SLIDER_MIN}</span>
      <input
        type="range"
        class="slider-input"
        min="${CONFIG.SLIDER_MIN}"
        max="${CONFIG.SLIDER_MAX}"
        step="${CONFIG.SLIDER_STEP}"
        value="${CONFIG.SLIDER_DEFAULT}"
        data-key="${key}"
      />
      <span class="slider-bound">${CONFIG.SLIDER_MAX}</span>
    </div>
    <span class="slider-value">${CONFIG.SLIDER_DEFAULT}</span>
  `;

  // Update weight on change
  row.querySelector('.slider-input').addEventListener('input', (e) => {
    const val = Number(e.target.value);
    weights.set(key, val);
    row.querySelector('.slider-value').textContent = val;

    // TODO: notify state.js
    // state.onWeightsChange(getWeights());
  });

  container.appendChild(row);
}

function removeSlider(key) {
  const row = document.querySelector(`.slider-row[data-key="${key}"]`);
  if (row) row.remove();
}


// *** UI HELPERS ***

function updateCounter() {
  const el = document.getElementById('controls-count');
  if (el) el.textContent = `${selected.size} / ${CONFIG.MAX_SELECTED} selected`;
}


// *** PUBLIC API *** (called by state.js to read current weights)

// Returns an array of { key, weight } for all selected attributes.
// If nothing is selected, returns an empty array.
export function getWeights() {
  return Array.from(selected).map(key => ({
    key,
    weight: weights.get(key) ?? CONFIG.SLIDER_DEFAULT,
  }));
}

// Returns the Set of currently selected keys (read-only reference).
export function getSelected() {
  return new Set(selected);
}
