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

// global variables
let svg;          // main SVG where everything is drawn
let projection;   // D3 projection for converting lat/lon to screen coordinates --> Madrid [-3.7, 40.4] to [520px, 230px]
let path;         // D3 path generator, used to convert GeoJSON data into SVG paths
let gMap;         // SVG group for map features (land, borders) --> countries
let gCities;      // SVG group for city dots                    --> points (cities)

let cities = [];              // list of city data loaded from JSON
let scoreMap = new Map();     // city name --> score

/*
DUDAS:

- No debería de conectarse el globe.js con la aplicación en el main? Por qué llamamos a updateDotSizes desde el state.js?

*/

// 'async' because we need to load geographic data before we can draw the map
export async function initGlobe() {
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

    gMap = svg.append('g').attr('class', 'map-layer');      // 1. first the map layer (countries)
    gCities = svg.append('g').attr('class', 'city-layer');  // 2. then the city layer (dots on top of countries)

    // Load geographic data and draw the map
    const world = await d3.json(
      // this URL contains TopoJSON data for world countries for D3 to render the map
      'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json' 
    );

    // Convert TopoJSON to GeoJSON features
    const land = topojson.feature(world, world.objects.land);       // land polygons
    const borders = topojson.mesh(world, world.objects.countries);  // country borders as lines

    // Load city data
    cities = await d3.json('data/cities.json');  // this URL contains our cities dataset

    // Draw the map and cities
    drawMap(land, borders);     // 1. draw the map (countries)
    drawCities();               // 2. draw the cities on top (dots) 
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
      .data(cities, currentCity => currentCity.city)  // 'currentCity' is the 'key' (the city name) to binding each city to a circle
      .join('circle')
      .attr('class', 'city-dot')
      .attr('cx', d => projection([d.lon, d.lat])[0]) // converts lat/lon to screen coordinates using the projection
      .attr('cy', d => projection([d.lon, d.lat])[1]) // same for y coordinate
      .attr('r', CONFIG.CITY_RADIUS)                  // initial radius (will be updated later based on score)
      .attr('fill', CONFIG.CITY_COLOR)                // initial color
      .attr('opacity', 0.85)
      .attr('stroke', '#0f172a')                    // border color
      .attr('stroke-width', 1)                        // border width
      .on('click', (event, clickedCity) => {
        event.stopPropagation();                      // prevents 'click' from propagating to other elements 
        selectCity(clickedCity);   // when a city dot is clicked, we select that city in the current state (which will trigger updates in other modules)
      });
}

/****************** INTERACTION HANDLERS ******************/

export function updateDotSizes(newscoreMap) {
    scoreMap = newscoreMap ?? new Map();

    const radiusScale = d3.scaleLinear()
      .domain([0, 1])
      .range([CONFIG.CITY_RADIUS_MIN, CONFIG.CITY_RADIUS_MAX]);

    gCities.selectAll('circle.city-dot')
      .transition()
      .duration(250)
      .attr('r', d => radiusScale(scoreMap.get(d.city) ?? 0));
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
