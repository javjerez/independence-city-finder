// globe.js — flat D3 world map with city dots
// Mounts into: #globe-container

import { selectCity } from './state.js';

const CONFIG = {
  CITY_RADIUS: 5,
  CITY_RADIUS_MIN: 3,
  CITY_RADIUS_MAX: 16,

  CITY_COLOR: '#38bdf8',
  CITY_COLOR_PRIMARY: '#ff7a3d',
  CITY_COLOR_COMPARISON: '#facc15',

  LAND_COLOR: '#254437',
  BORDER_COLOR: 'rgba(255,255,255,0.25)',
};

let svg;
let projection;
let path;
let gMap;
let gCities;

let cities = [];
let scoreCache = new Map();

export async function initGlobe() {
  const container = document.getElementById('globe-container');
  container.innerHTML = '';

  const { width, height } = container.getBoundingClientRect();

  svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  projection = d3.geoNaturalEarth1()
    .translate([width / 2.25, height / 1.75])
    .scale(width / 4.8);

  path = d3.geoPath(projection);

  gMap = svg.append('g').attr('class', 'map-layer');
  gCities = svg.append('g').attr('class', 'city-layer');

  const world = await d3.json(
    'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
  );

  const land = topojson.feature(world, world.objects.land);
  const borders = topojson.mesh(world, world.objects.countries);

  cities = await d3.json('data/cities.json');

  drawMap(land, borders);
  drawCities();
}

function drawMap(land, borders) {
  gMap.append('path')
    .datum(land)
    .attr('class', 'map-land')
    .attr('d', path)
    .attr('fill', CONFIG.LAND_COLOR);

  gMap.append('path')
    .datum(borders)
    .attr('class', 'map-borders')
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', CONFIG.BORDER_COLOR)
    .attr('stroke-width', 0.5);
}

function drawCities() {
  gCities.selectAll('circle.city-dot')
    .data(cities, d => d.city)
    .join('circle')
    .attr('class', 'city-dot')
    .attr('cx', d => projection([d.lon, d.lat])[0])
    .attr('cy', d => projection([d.lon, d.lat])[1])
    .attr('r', CONFIG.CITY_RADIUS)
    .attr('fill', CONFIG.CITY_COLOR)
    .attr('opacity', 0.85)
    .attr('stroke', '#0f172a')
    .attr('stroke-width', 1)
    .on('click', (event, d) => {
      event.stopPropagation();
      selectCity(d);
    });
}

/****************** INTERACTION HANDLERS ******************/

export function updateDotSizes(newScoreCache) {
  scoreCache = newScoreCache ?? new Map();

  const radiusScale = d3.scaleLinear()
    .domain([0, 1])
    .range([CONFIG.CITY_RADIUS_MIN, CONFIG.CITY_RADIUS_MAX]);

  gCities.selectAll('circle.city-dot')
    .transition()
    .duration(250)
    .attr('r', d => radiusScale(scoreCache.get(d.city) ?? 0));
}

export function updateDotStyles(primaryCity, comparedCities = []) {
  if (!gCities) return;

  const comparedNames = new Set(comparedCities.map(c => c.city));

  gCities.selectAll('circle.city-dot')
    .attr('fill', d => {
      if (d.city === primaryCity?.city) return CONFIG.CITY_COLOR_PRIMARY;
      if (comparedNames.has(d.city)) return CONFIG.CITY_COLOR_COMPARISON;
      return CONFIG.CITY_COLOR;
    });
}
