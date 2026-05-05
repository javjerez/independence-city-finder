 // JAVASCRIPT MODULES

/*
Load order: 
    1. state first (shared store)
    2. Then other feature modules (globe, controls, city card, comparison)
*/

import { initState } from './state.js';

import { initGlobe } from './globe.js';
import { initControls } from './controls.js';
import { initCityCard } from './cityCard.js';
import { initComparison } from './comparison.js';

const cities = await d3.json('data/cities.json');

initState(cities);
initGlobe();
initControls();
initCityCard();
initComparison();