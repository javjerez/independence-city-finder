/*
Load order: 
    1. state first (shared store)
    2. Then other feature modules (globe, controls, city card, comparison, etc
*/

import { initState, onWeightsChange, setPrimaryCityFromHeader } from './state.js';
import { initControls, getWeights } from './controls.js';
import { initGlobe } from './globe.js';
import { initCityCard } from './cityCard.js';
import { initBarChart } from './barChart.js';
import { initRadarChart } from './radarChart.js';

// Load data
const cities = await d3.json('data/pretty_columns_dataset.json');
const attributes= await fetch("./data/attributes.json").then(r => r.json());

// Load state first (since it is a shared store, other modules depend on it)
initState(attributes, cities);

initControls(attributes, () => {
    onWeightsChange(getWeights());                    // DO NOT SEND THE 'getWeights()' function !!!
    console.log('UPDATE: weights changed!!!');
});

initGlobe(cities);
initBarChart(attributes);
initRadarChart(attributes);
initCityCard(attributes, setPrimaryCityFromHeader);   // for changing the names of the header in the city card
