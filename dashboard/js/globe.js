// globe.js — flat D3 world map with city dots
// Mounts into: #globe-container

import { selectCity } from './state.js';

const CONFIG = {
    CITY_RADIUS: 4,
    CITY_RADIUS_MIN: 3,
    CITY_RADIUS_MAX: 16,

    CITY_COLOR: '#38bdf8',
    CITY_COLOR_PRIMARY: '#ff7a3d',
    CITY_COLOR_COMPARISON: '#facc15',

    LAND_COLOR: '#254437',
    BORDER_COLOR: 'rgba(255,255,255,0.25)',

    // ZOOM
    MIN_ZOOM: 1,
    MAX_ZOOM: 5,
};

// global variables
let svg;          // main SVG where everything is drawn
let projection;   // D3 projection for converting lat/lon to screen coordinates --> Madrid [-3.7, 40.4] to [520px, 230px]
let path;         // D3 path generator, used to convert GeoJSON data into SVG paths

let gViewport;    // SVG group for viewport transformations (zoom/pan)  --> contains gMap and gCities
let gMap;         // SVG group for map features (land, borders)         --> countries
let gCities;      // SVG group for city dots                            --> points (cities)

let currentZPTransform = d3.zoomIdentity; // stores the current zoom, position and scale
// x: horizontal translation (pan)
// y: vertical translation (pan)
// k: scale (zoom level)

let cities = [];              // list of city data loaded from JSON
let scoreMap = new Map();     // city name --> score

// For 'hover' tooltip
let tooltip = null;
let tooltipTimer = null;

/*
DUDAS:

- No debería de conectarse el globe.js con la aplicación en el main? Por qué llamamos a updateDotSizes desde el state.js?

*/

// 'async' because we need to load geographic data before we can draw the map
export async function initGlobe(citiesData) {
    const map_container = document.getElementById('globe-container');
    map_container.innerHTML = '';

    const { width, height } = map_container.getBoundingClientRect();

    // Create SVG element
    svg = d3.select(map_container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Define map projection
    projection = d3.geoNaturalEarth1()
      .translate([width / 2.25, height / 1.75])
      .scale(width / 4.8);

    // Create path generator (converts GeoJSON to SVG paths)
    path = d3.geoPath(projection);

    // the 'g' is used to group SVG elements together
    gViewport = svg.append('g').attr('class', 'map-viewport');    // 1. first the viewport group --> SVG container (for zoom/pan)
    gMap = gViewport.append('g').attr('class', 'map-layer');      // 2. then the map layer (countries)
    gCities = gViewport.append('g').attr('class', 'city-layer');  // 3. then the city layer (dots on top of countries)

    // Load geographic data and draw the map
    const world = await d3.json(
      // this URL contains TopoJSON data for world countries for D3 to render the map
      'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json' 
    );

    // Convert TopoJSON to GeoJSON features
    const land = topojson.feature(world, world.objects.land);       // land polygons
    const borders = topojson.mesh(world, world.objects.countries);  // country borders as lines

    // Load city data
    cities = citiesData; // citiesData is passed from main.js

    // Create tooltip element to hover on city dots (hidden by default)
    tooltip = d3.select(map_container)
      .append('div')
      .attr('id', 'map-tooltip')
      .style('display', 'none');

    // Draw the map and cities
    drawMap(land, borders);     // 1. draw the map (countries)
    drawCities();               // 2. draw the cities on top (dots)
    attachZoom();               // 3. attach zoom/pan behavior to the SVG
}

// Function to draw the map (countries and borders)
function drawMap(land, borders) {
    gMap.append('path')
      .datum(land)
      .attr('class', 'map-land')
      .attr('d', path)                  // 'path' transforms world geometry (GeoJSON) to an SVG line (path)
      .attr('fill', CONFIG.LAND_COLOR);

    gMap.append('path')
      .datum(borders)
      .attr('class', 'map-borders')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', CONFIG.BORDER_COLOR)
      .attr('stroke-width', 0.5);
}

// Function to draws a dot on the map per city
function drawCities() {
    gCities.selectAll('circle.city-dot')
    .data(cities, currentCity => currentCity.city)          // 'currentCity' is the 'key' (the city name) to binding each city to a circle
    .join('circle')
    .attr('class', 'city-dot')
    .attr('cx', currentCity => projection([currentCity.lon, currentCity.lat])[0]) // converts lat/lon to screen coordinates using the projection
    .attr('cy', currentCity => projection([currentCity.lon, currentCity.lat])[1]) // same for y coordinate
    .attr('r', currentCity => getCityRadius(currentCity))   // initial radius based on initial score
    .attr('fill', CONFIG.CITY_COLOR)                        // initial color
    .attr('opacity', 0.85)
    .attr('stroke', '#0f172a')                            // border color
    .attr('stroke-width', getCityStrokeWidth())                                // border width

    // City 'click' --> we connect it to the other views
    .on('click', (event, clickedCity) => {
        event.stopPropagation();            // prevents 'click' from propagating to other elements 
        selectCity(clickedCity);            // we select the city in the app 'state'
    })

    // City 'hover' --> show tooltip with city name
    .on('mouseenter', (event, hoveredCity) => {
      tooltipTimer = setTimeout(() => {
        showTooltip(event, hoveredCity);
      }, 120);
    })

    .on('mouseleave', () => {
      hideTooltip();
    })

    .on('mousemove', (event) => {
      tooltip
        .style('left', (event.offsetX + 12) + 'px')
        .style('top', (event.offsetY - 12) + 'px');
    })
}

/************************ ZOOM & PAN **********************/

// Computes the radius of a city dot based on its SCORE and ZOOM level (currentZPTransform.k)
function getCityRadius(city) {
    // the city does not have a score --> '0'
    const score = scoreMap.get(city.city) ?? 0;

    // Converts scores (0 to 1) to a radius size in the range [CITY_RADIUS_MIN, CITY_RADIUS_MAX]
    const radiusScale = d3.scaleLinear()
      .domain([0, 1])
      .range([CONFIG.CITY_RADIUS_MIN, CONFIG.CITY_RADIUS_MAX]);

    // if the city has a score, use the scaled radius, otherwise use the default radius
    const baseRadius = scoreMap.size > 0
      ? radiusScale(score)
      : CONFIG.CITY_RADIUS;

    // Adjust the radius based on the current zoom level (currentZPTransform.k)
    return baseRadius / currentZPTransform.k;
}

// Computes the dot border of eac city dot based on the current zoom
function getCityStrokeWidth() {
    return 1 / currentZPTransform.k;
}
// more zoom --> smaller radius and stroke width
// less zoom --> bigger radius and stroke width

// Updates the radius and stroke width of each city dot based on the current zoom level
function updateCityZoom() {
    // if cities not drawn yet --> do nothing
    if (!gCities) return;

    // do the update
    gCities.selectAll('circle.city-dot')
      .attr('r', currentCity => getCityRadius(currentCity))
      .attr('stroke-width', getCityStrokeWidth());
}

// Functionn to activate the zoom/pan behavior on the SVG
function attachZoom() {
    // zoom: supports 'drag', 'scroll zoom' and 'trackpad zoom' (for laptops)
    const zoom = d3.zoom()
      .scaleExtent([CONFIG.MIN_ZOOM, CONFIG.MAX_ZOOM])

      // every time the user 'drags', 'scrolls zoom' or 'trackpad zoom':
      // this function is called with the new zoom/pan transform
      .on('zoom', (event) => {
        currentZPTransform = event.transform;             // update the maps current zoom/pan trnasform

        gViewport.attr('transform', currentZPTransform);  // apply the new transform to the viewport

        // for not being too big when zooming in: 
        updateCityZoom();    // finally, update the city dot sizes (visually consistent)
      });

    svg.call(zoom);
}

/********************** HOVER TOOLTIP *********************/

// Shows the tooltip with city name and country when hovering on a city dot
function showTooltip(event, city) {
  tooltip
    .style('display', 'block')
    .html(`
      <div class="tooltip-city">
        ${city.city}
      </div>
      <div class="tooltip-country">
        ${city.country}
      </div>
    `)
    .style('left', (event.offsetX + 12) + 'px')
    .style('top', (event.offsetY - 12) + 'px');
}

// Hides the tooltip when the mouse leaves a city dot
function hideTooltip() {
  clearTimeout(tooltipTimer);

  tooltip.style('display', 'none');
}

/****************** INTERACTION HANDLERS ******************/

// Function to update the radius of city dots based on their scores
export function updateDotSizes(newscoreMap) {
    scoreMap = newscoreMap ?? new Map();  // if map does not exist, use empty map (not possible case)

    // if cities not drawn yet --> do nothing
    if (!gCities) return; // To avoid errors when trying to update dot sizes before the map is initialized

    gCities.selectAll('circle.city-dot')
    .transition()
    .duration(250)
    .attr('r', currentCity => getCityRadius(currentCity))
    .attr('stroke-width', getCityStrokeWidth());
}

// Function to update the color of city dots based on selection and comparison
export function updateDotsColor(primaryCity, comparedCities = []) {
    // case: no cities drawn yet (map not initialized)
    if (!gCities) return;

    // create a 'set' of compared city names for quick lookup
    const comparedNames = new Set(comparedCities.map(compareCity => compareCity.city));

    // update the color of each city dot based on whether it is the primary city, a compared city or neither
    gCities.selectAll('circle.city-dot')
      .attr('fill', currentCity => {
        if (currentCity.city === primaryCity?.city) return CONFIG.CITY_COLOR_PRIMARY;
        if (comparedNames.has(currentCity.city)) return CONFIG.CITY_COLOR_COMPARISON;
        return CONFIG.CITY_COLOR;
      });
}
