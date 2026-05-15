// GENERAL INFO
//  controls.js --> Attribute selector + weight sliders
//  Mounts into --> #controls-container
//  Exports     --> getWeights(), called by state.js


// *** CONFIGURATION ***

const CONFIG = {
  MAX_SELECTED: 5,      // max attributes selectable at once
  SLIDER_MIN: 1,        // min weight value
  SLIDER_MAX: 5,        // max weight value  ← adjust here
  SLIDER_STEP: 1,       // step increment
  SLIDER_DEFAULT: 3,    // weight when an attribute is first selected

  // <--- adjust here when panel width is finalised
};

// *** ATTRIBUTE DEFINITIONS *** (All numeric metrics from cities.json, grouped by source)

/*
'attribute' (the key): it is the dot-path used to read the value from a city object
'label': it is what appears in the UI box
*/

export const ATTRIBUTES = [
  { attribute: 'housing', label: 'Housing' },
  { attribute: 'cost_of_living', label: 'Cost of Living' },
  { attribute: 'startups', label: 'Startups' },
  { attribute: 'venture_capital', label: 'Venture Capital' },
  { attribute: 'travel_connectivity', label: 'Travel Connectivity' },
  { attribute: 'commute', label: 'Commute' },
  { attribute: 'business_freedom', label: 'Business Freedom' },
  { attribute: 'safety', label: 'Safety' },
  { attribute: 'healthcare', label: 'Healthcare' },
  { attribute: 'education', label: 'Education' },
  { attribute: 'environmental_quality', label: 'Environmental Quality' },
  { attribute: 'economy', label: 'Economy' },
  { attribute: 'taxation', label: 'Taxation' },
  { attribute: 'internet_access', label: 'Internet Access' },
  { attribute: 'leisure_&_culture', label: 'Leisure & Culture' },
  { attribute: 'tolerance', label: 'Tolerance' },
  { attribute: 'outdoors', label: 'Outdoors' },

  // Extra datasets
  { attribute: 'population', label: 'Population' },
  // { attribute: 'mcmeal_combo', label: 'McMeal Price' },
  { attribute: 'avg_monthly_net_salary', label: 'Monthly Salary' },
  // { attribute: 'internet_60mbps', label: 'Internet 60Mbps Price' },

  // Sunshine
  { attribute: 'sun_year', label: 'Yearly Sunshine' }
  // { attribute: 'temp_year', label: 'Yearly Temperature' }
];


// *** MODULE STATE *** 

// 'Set' automatically avoids duplicates (and easy add/remove operations)
const selected = new Set();   // selected: Set of attribute-keys currently selected

// 'Map' allows to assciate each selected attribute with its slide value (weight)
const weights = new Map();   // weights:  Map of key --> slider value (only for selected keys)

// Callback function to notify the application when weights change
let notifyChange = () => { };

// *** INITIALISE *** (call once from index.html after DOM is ready)

export function initControls(onChange = () => { }) {
  // set the callback to notify state.js when weights change
  notifyChange = onChange;

  const controls_container = document.getElementById('controls-container');
  controls_container.innerHTML = '';   // clear any previous content

  // Wrapper
  const wrapper = document.createElement('div');
  wrapper.id = 'controls-wrapper';
  controls_container.appendChild(wrapper);

  // Header
  const header = document.createElement('div');
  header.id = 'controls-header';
  header.innerHTML = `
    <span id="controls-title">Attributes</span>
    <span id="controls-count">0 / ${CONFIG.MAX_SELECTED} selected</span>
  `;
  wrapper.appendChild(header);

  // Content (grid of attributes + sliders)
  const content = document.createElement('div');
  content.id = 'controls-content';
  wrapper.appendChild(content);

  // Attribute grid
  const grid = document.createElement('div');
  grid.id = 'controls-grid';
  content.appendChild(grid);

  // Sliders container
  const slidersContainer = document.createElement('div');
  slidersContainer.id = 'controls-sliders';
  content.appendChild(slidersContainer);

  // Create a button for each attribute
  ATTRIBUTES.forEach(attr => {
    const new_attr_button = document.createElement('button');
    new_attr_button.classList.add('attr-button');
    new_attr_button.dataset.attribute = attr.attribute;     // attribute is the 'key' used in the map
    new_attr_button.textContent = attr.label;
    new_attr_button.title = attr.label;         // full label visible on hover
    new_attr_button.addEventListener('click', () => onBoxClick(attr.attribute));
    grid.appendChild(new_attr_button);
  });
}


// *** INTERACTION HANDLERS *** 

function onBoxClick(attribute) {
  // Deselect attribute (already contained in the set)
  if (selected.has(attribute)) {
    selected.delete(attribute);     // remove from set
    weights.delete(attribute);      // remove weight from map
    removeSlider(attribute);        // remove slider from UI

  } else {
    // Max attributes reached --> do nothing
    if (selected.size >= CONFIG.MAX_SELECTED) return;

    // Select attribute
    selected.add(attribute);                        // add to set
    weights.set(attribute, CONFIG.SLIDER_DEFAULT);  // add to map with default weight
    addSlider(attribute);                           // add slider to UI
  }

  // Update box highlight
  const button = document.querySelector(`.attr-button[data-attribute="${attribute}"]`);     // find the box corresponding to this attribute
  if (button) button.classList.toggle('attr-button--selected', selected.has(attribute)); // Assign highlight class

  // Update counter
  updateCounter();

  // notify state.js that weights changed
  notifyChange();
}

// *** SLIDER MANAGEMENT ***

function addSlider(attribute) {
  const attr = ATTRIBUTES.find(a => a.attribute === attribute);
  const sliders_container = document.getElementById('controls-sliders');

  const new_slider = document.createElement('div');
  new_slider.classList.add('slider-row');
  new_slider.dataset.attribute = attribute;

  new_slider.innerHTML = `
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
        data-attribute="${attribute}"
      />
      <span class="slider-bound">${CONFIG.SLIDER_MAX}</span>
    </div>
    <span class="slider-value">${CONFIG.SLIDER_DEFAULT}</span>
  `;

  // Update weight on change
  new_slider.querySelector('.slider-input').addEventListener('input', (e) => {
    const val = Number(e.target.value);
    weights.set(attribute, val);                                        // update weight in map
    new_slider.querySelector('.slider-value').textContent = val;  // update displayed value

    // notify state.js that weights changed
    notifyChange();
  });

  sliders_container.appendChild(new_slider);
}

function removeSlider(attribute) {
  const slider = document.querySelector(`.slider-row[data-attribute="${attribute}"]`);
  if (slider) slider.remove();
}

// *** UI HELPERS ***

function updateCounter() {
  const counter = document.getElementById('controls-count');
  if (counter) counter.textContent = `${selected.size} / ${CONFIG.MAX_SELECTED} selected`;
}


// *** PUBLIC API *** (called by state.js to read current weights)

// Returns an array of { attribute -> weight } for all selected attributes
// If nothing is selected, returns an empty array
export function getWeights() {
  return Array.from(selected).map(attribute => ({
    attribute,
    weight: weights.get(attribute) ?? CONFIG.SLIDER_DEFAULT,  // fallback to default if not found (should not happen)
  }));
}

export function getSelectedAttributes() {
  return Array.from(selected);
}

// DEBUGGING ATTRIBUTES
// 'group': groups attributes (for future filtering or styling)

/*
// Quality of Life (Numbeo)
{ attribute: 'qol.quality_of_life_index', group: 'QoL', label: 'Quality of Life' },
{ attribute: 'qol.purchasing_power_index', group: 'QoL', label: 'Purchasing Power' },
{ attribute: 'qol.safety_index', group: 'QoL', label: 'Safety (QoL)' },
{ attribute: 'qol.healthcare_index', group: 'QoL', label: 'Healthcare (QoL)' },
{ attribute: 'qol.cost_of_living_index', group: 'QoL', label: 'Cost of Living (QoL)' },
{ attribute: 'qol.property_price_to_income_ratio', group: 'QoL', label: 'Property/Income Ratio' },
{ attribute: 'qol.traffic_commute_time_index', group: 'QoL', label: 'Commute Time' },
{ attribute: 'qol.pollution_index', group: 'QoL', label: 'Pollution (QoL)' },
{ attribute: 'qol.climate_index', group: 'QoL', label: 'Climate (QoL)' },
*/

/*
// Urban Area Scores
{ attribute: 'ua_scores.housing', group: 'Urban', label: 'Housing' },
{ attribute: 'ua_scores.cost_of_living', group: 'Urban', label: 'Cost of Living (UA)' },
{ attribute: 'ua_scores.startups', group: 'Urban', label: 'Startups' },
{ attribute: 'ua_scores.venture_capital', group: 'Urban', label: 'Venture Capital' },
{ attribute: 'ua_scores.travel_connectivity', group: 'Urban', label: 'Travel Connectivity' },
{ attribute: 'ua_scores.commute', group: 'Urban', label: 'Commute (UA)' },
{ attribute: 'ua_scores.business_freedom', group: 'Urban', label: 'Business Freedom' },
{ attribute: 'ua_scores.safety', group: 'Urban', label: 'Safety (UA)' },
{ attribute: 'ua_scores.healthcare', group: 'Urban', label: 'Healthcare (UA)' },
{ attribute: 'ua_scores.education', group: 'Urban', label: 'Education' },
{ attribute: 'ua_scores.environmental_quality', group: 'Urban', label: 'Environment' },
{ attribute: 'ua_scores.economy', group: 'Urban', label: 'Economy' },
{ attribute: 'ua_scores.taxation', group: 'Urban', label: 'Taxation' },
{ attribute: 'ua_scores.internet_access', group: 'Urban', label: 'Internet Access (UA)' },
{ attribute: 'ua_scores.leisure_culture', group: 'Urban', label: 'Leisure & Culture' },
{ attribute: 'ua_scores.tolerance', group: 'Urban', label: 'Tolerance' },
{ attribute: 'ua_scores.outdoors', group: 'Urban', label: 'Outdoors' },
*/

/*
// Salary & Cost
{ attribute: 'salary.avg_monthly_net_usd', group: 'Economy', label: 'Avg Net Salary' },
{ attribute: 'cost_of_living_items.meal_inexpensive_restaurant_usd', group: 'Economy', label: 'Meal (cheap)' },
{ attribute: 'cost_of_living_items.monthly_transport_pass_usd', group: 'Economy', label: 'Transport Pass' },
{ attribute: 'cost_of_living_items.rent_1br_city_center_usd', group: 'Economy', label: 'Rent 1BR (center)' },
{ attribute: 'cost_of_living_items.groceries_index', group: 'Economy', label: 'Groceries Index' },
*/

/*
// Happiness
{ attribute: 'happiness.ladder_score', group: 'Happiness', label: 'Happiness Score' },
{ attribute: 'happiness.freedom_score', group: 'Happiness', label: 'Freedom' },
{ attribute: 'happiness.social_support', group: 'Happiness', label: 'Social Support' },
{ attribute: 'happiness.healthy_life_expectancy', group: 'Happiness', label: 'Life Expectancy' },
*/

/*
// Environment & Infrastructure
{ attribute: 'sunshine.annual_hours', group: 'Environment', label: 'Sunshine Hours' },
{ attribute: 'avg_temperature_c', group: 'Environment', label: 'Avg Temperature' },
{ attribute: 'internet_speed_mbps', group: 'Environment', label: 'Internet Speed' },
{ attribute: 'aqi', group: 'Environment', label: 'Air Quality (AQI)' },
*/

/*
// Society
{ attribute: 'lgbtq_legal_index', group: 'Society', label: 'LGBTQ+ Legal Index' },
{ attribute: 'english_proficiency_score', group: 'Society', label: 'English Proficiency' },
*/

/*
// Numbeo Country
{ attribute: 'numbeo_country.healthcare_index', group: 'Country', label: 'Healthcare (Country)' },
{ attribute: 'numbeo_country.crime_index', group: 'Country', label: 'Crime (Country)' },
{ attribute: 'numbeo_country.safety_index', group: 'Country', label: 'Safety (Country)' },
{ attribute: 'numbeo_country.pollution_index', group: 'Country', label: 'Pollution (Country)' },
*/
