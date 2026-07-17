/*
City information card + radar chart
Mounts into #city-card-container
*/

import { getScoreColor, COLORS } from './colors.js';

const CONFIG = {
  RADAR_LEVELS: 4,
  RADAR_MIN_LENGTH: 120,
  RADAR_MARGIN: 40,
  RADAR_MAX_VALUE: 1,
  RADAR_COLOR: COLORS.accent,
  RADAR_FILL_OPACITY: 0.22,
  RADAR_STROKE_WIDTH: 2,
  DOT_RADIUS: 4,
  MIN_SCORE: 0.5,
  MID_SCORE: 0.75,
};

let _primaryCity = null;
let _comparedCities = [];
let _weights = [];
let _scores = new Map();         // ("attribute" --> score) - normalized values of current city
let _cityScore = null;
let _onCityTabClick = () => { }; // saves a functions that is executed when we click a city in the header

// Handling attributes
let ATTRIBUTES = {};

export function initCityCard(attributes, onCityTabClick = () => { }) {
  ATTRIBUTES = attributes;
  _onCityTabClick = onCityTabClick;
  renderCityCard();
}

// Called by state.js when the primaryCity, compared cities, weights or score changes
export function updateCityCard(primaryCity, comparedCities, weights, scores, cityScore) {
  _primaryCity = primaryCity;
  _comparedCities = comparedCities ?? [];
  _weights = weights ?? [];
  _scores = scores ?? new Map();
  _cityScore = cityScore ?? null;
  // '??' means: if value is NULL/undefined, we use default value

  renderCityCard();
}

// Renders all visual sections of the city card
function renderCityCard() {
  renderTabs();
  renderInfo();
  renderRadar();
}

// Prints the buttons of the selected cities in the header
function renderTabs() {
  const tabs = document.getElementById('city-card-tabs');
  if (!tabs) return;

  // Join all the selected cities (deleting NULL/empty values)
  const cities = [_primaryCity, ..._comparedCities].filter(Boolean);

  if (cities.length === 0) {
    tabs.innerHTML = `<span class="city-card-empty-tab">No selected cities</span>`;
    return;
  }
  if (cities.length === 1) {
    tabs.innerHTML = `<span class="city-card-empty-tab">Select at least two cities to compare them</span>`;
    return;
  }

  tabs.innerHTML = '';

  // Creates a button for each selected city
  cities.forEach((city, index) => {
    const button = document.createElement('button');
    button.className = index === 0 ? 'city-tab city-tab--active' : 'city-tab';
    button.textContent = `${city.city}`; // {city.country}

    // each button executes the function from state.js --> TODO
    button.addEventListener('click', () => _onCityTabClick(city));
    tabs.appendChild(button);
  });
}

// Prints all the information related to the primary city
function renderInfo() {
  const title = document.getElementById('city-card-title');
  const subtitle = document.getElementById('city-card-subtitle');
  const stats = document.getElementById('city-card-stats');
  const attributes = document.getElementById('city-card-attributes');

  if (!_primaryCity) {
    title.textContent = 'No city selected';
    subtitle.textContent = 'Click a city on the map to inspect it';
    stats.innerHTML = '';
    attributes.innerHTML = '';
    return;
  }

  title.textContent = `${_primaryCity.city}, ${_primaryCity.country}`;

  const score10 = _cityScore != null ? _cityScore * 100 : null;

  // subtitle.textContent = `Population: ${formatNumber(_primaryCity.population)}
  subtitle.innerHTML = `
    Population: ${formatNumber(_primaryCity.population)}<br>
    Score: <strong>${score10 != null ? score10.toFixed(1) : '—'} / 100</strong>
  `;

  // Compute derived affordability indicator
  // "How many McMeal menus can be bought with one average monthly salary"
  const salary = _primaryCity.avg_monthly_net_salary;
  const mcmeal = _primaryCity.mcmeal_combo;
  const mcMeals = salary && mcmeal ? salary / mcmeal : null;

  stats.innerHTML = `
    <p class="mcmeal-summary">
      Average salary: <strong>${formatMoney(salary)}</strong> - You can buy 
      <strong>${mcMeals ? Math.round(mcMeals) : '—'}</strong> McMeals/month
    </p>
  `;

  /*
    <div class="stat-card">
      <span class="stat-label">McMeal price</span>
      <strong>${formatMoney(mcmeal)}</strong>
    </div>

    <div class="stat-card stat-card--highlight">
      <span class="stat-label">McMeals per salary</span>
      <strong>${mcMeals ? Math.round(mcMeals) : '—'}</strong>
    </div>
  */

  attributes.innerHTML = '';

  // For each selected attribute, show only the normalized score.
  // This keeps the row compact and avoids vertical overflow in the card.
  _weights.forEach(({ attribute }) => {
    const name = getAttributeName(attribute);
    const descr = getAttributeDescription(attribute);
    const normalized = _scores.get(attribute);  // value between 0 and 1
    const score10 = normalized != null ? normalized * 100 : null;
    const scoreColor = getScoreColor(normalized, CONFIG.MIN_SCORE, CONFIG.MID_SCORE);

    const row = document.createElement('div');
    row.className = 'attribute-row';

    row.innerHTML = `
      <span class="attribute-label" title="${descr}">${name}</span>

      <div class="attribute-bar">
        <div 
          class="attribute-bar-fill" 
          style="
                width: ${score10 != null ? score10 : 0}%;
                background: ${scoreColor};
                "
        ></div>
      </div>

      <strong class="attribute-score">
        ${score10 != null ? score10.toFixed(1) : '—'}
      </strong>
    `;

    attributes.appendChild(row);
  });
}


function _renderPlaceholder() {
  const panel = document.getElementById('city-card-radar');
  panel.innerHTML = '';
  if (!_primaryCity) {
    panel.innerHTML = `<div class="radar-placeholder">Select a city to show its fingerprint</div>`;
    return;
  }
  
  if (_weights.length < 3) {
    panel.innerHTML = `<div class="radar-placeholder">Select at least 3 attributes for a useful radar chart</div>`;
    return;
  }
}


// Prints the radar chart
function renderRadar() {
  const panel = document.getElementById('city-card-radar');
  panel.innerHTML = '';

  if (!_primaryCity || _weights.length < 3){
    _renderPlaceholder();
    return;
  }
  
  const wrapper = document.createElement('div');
  wrapper.className = `city-radar-wrap`;

  // ---
  panel.appendChild(wrapper);

  const rect = panel.getBoundingClientRect();
  const size = Math.max(
    CONFIG.RADAR_MIN_LENGTH,
    Math.min(rect.width, rect.height)
  );
  // ---

  const width = wrapper.clientWidth;

  // minimum size of the graph is equal to RADAR_MIN_LENGTH
  //const size = Math.max(CONFIG.RADAR_MIN_LENGTH, Math.min(width, height));
  const radius = size / 2 - CONFIG.RADAR_MARGIN;
  const center = size / 2;
  
  const svg = d3.select(wrapper)
    .append('svg')
    /*
    .attr('width', wrapper.clientWidth)
    .attr('height', wrapper.clientHeight);
    */
    .attr('width', size)
    .attr('height', size)
    .attr('viewBox', `0 0 ${size} ${size}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg.append('g')
    .attr('transform', `translate(${center}, ${center +20})`);

  /*
  We divide the axis (number of weights) in a circle distribution
  The circle is divided into 'n' equal parts
  "-Math.PI / 2" starts the first axis at the top
  */
  const n = _weights.length;
  const angle = i => (2 * Math.PI * i / n) - Math.PI / 2;

  // Converts a normalized scores [0, 1] into pixles (radial distances)
  const rScale = d3.scaleLinear()
    .domain([0, CONFIG.RADAR_MAX_VALUE])
    .range([0, radius]);

  // Draws the inner reference rings of the figure
  // Their shapen depends on the number of selected values
  for (let level = 1; level <= CONFIG.RADAR_LEVELS; level++) {
    const r = radius * level / CONFIG.RADAR_LEVELS;

    const ringPoints = d3.range(n).map(i => {
      const a = angle(i);
      return [r * Math.cos(a), r * Math.sin(a)];
    });

    g.append('polygon')
      .attr('points', ringPoints.map(p => p.join(',')).join(' '))
      .attr('class', 'radar-grid-ring');
  }

  // for each attribute, draws a line from the center to the border and puts the label outside
  _weights.forEach(({ attribute }, i) => {
    const a = angle(i);

    g.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', radius * Math.cos(a))
      .attr('y2', radius * Math.sin(a))
      .attr('class', 'radar-axis');

    g.append('text')
      .attr('x', (radius + 8) * Math.cos(a))
      .attr('y', (radius + 8) * Math.sin(a))
      .attr('text-anchor', Math.cos(a) > 0.2 ? 'start' : Math.cos(a) < -0.2 ? 'end' : 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('class', 'radar-label')
      // cuts the long labels so that they occupy too much space
      .text(shortLabel(getAttributeName(attribute)))
      .append('title')
      .text(`${getAttributeName(attribute)}`)  
    });

  // For each attribute:
  const dataPoints = _weights.map(({ attribute }, i) => {
    // Read normalized score
    const value = _scores.get(attribute) ?? 0;

    // Convert the score into a radius
    const r = rScale(value);

    // Calculates position (x,y), with 'sin' and 'cos'
    const a = angle(i);
    return [r * Math.cos(a), r * Math.sin(a)];
  });

  g.append('polygon')
    .attr('points', dataPoints.map(p => p.join(',')).join(' '))
    .attr('class', 'radar-area');

  g.selectAll('.radar-dot')
    .data(dataPoints)
    .join('circle')
    .attr('class', 'radar-dot')
    .attr('cx', d => d[0])
    .attr('cy', d => d[1])
    .attr('r', CONFIG.DOT_RADIUS);
}

function getAttributeName(attribute) {
  return ATTRIBUTES[attribute]?.name ?? attribute;
}

function getAttributeDescription(attribute) {
  return ATTRIBUTES[attribute]?.description ?? null;
}

// 2 decimal values format
function formatMoney(value) {
  return value == null || isNaN(value) ? '—' : `$${Number(value).toFixed(0)}`;
}

function formatNumber(value) {
  return value == null || isNaN(value) ? '—' : Number(value).toLocaleString();
}

function formatValue(value) {
  if (value == null || isNaN(value)) return '—';
  return Number(value).toFixed(2);
}

function shortLabel(label) {
  return label.length > 10 ? label.slice(0, 9) + '…' : label;
}
