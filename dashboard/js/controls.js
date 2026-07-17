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
};


// *** MODULE STATE *** 

// 'Set' automatically avoids duplicates (and easy add/remove operations)
const selected = new Set();   // selected: Set of attribute-keys currently selected

// 'Map' allows to assciate each selected attribute with its slide value (weight)
const weights = new Map();   // weights:  Map of key --> slider value (only for selected keys)

// Callback function to notify the application when weights change
let notifyChange = () => { };

// Handling attributes
let ATTRIBUTES = {};


// *** INITIALISE *** (call once from index.html after DOM is ready)

export function initControls(attributes, onChange = () => { }) {
  // Load the attributes
  ATTRIBUTES = attributes;

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
  Object.entries(ATTRIBUTES).forEach(([attribute, meta]) => {
    if (meta.visualize === true){
      const new_attr_button = document.createElement('button');
      new_attr_button.classList.add('attr-button');
      new_attr_button.dataset.attribute = attribute;     // attribute is the 'key' used in the map
      new_attr_button.textContent = meta.name;
      new_attr_button.title = meta.description ?? meta.name;         // full label visible on hover
      new_attr_button.addEventListener('click', () => onBoxClick(attribute));
      grid.appendChild(new_attr_button);
    }
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
  const button = document.querySelector(`.attr-button[data-attribute="${attribute}"]`);   // find the box corresponding to this attribute
  if (button) button.classList.toggle('attr-button--selected', selected.has(attribute));  // Assign highlight class

  // Update counter
  updateCounter();

  // notify state.js that weights changed
  notifyChange();
}


// *** SLIDER MANAGEMENT ***

function addSlider(attribute) {
  const meta = ATTRIBUTES[attribute];
  const sliders_container = document.getElementById('controls-sliders');

  const new_slider = document.createElement('div');
  new_slider.classList.add('slider-row');
  new_slider.dataset.attribute = attribute;

  new_slider.innerHTML = `
    <label class="slider-label">${meta.name}</label>
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
    weights.set(attribute, val);                                    // update weight in map
    new_slider.querySelector('.slider-value').textContent = val;    // update displayed value

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
