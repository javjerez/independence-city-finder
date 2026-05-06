 // JAVASCRIPT MODULES

/*
Load order: 
    1. state first (shared store)
    2. Then other feature modules (globe, controls, city card, comparison)
*/

// Load state first (since it is a shared store, other modules depend on it)
import { initState, onWeightsChange } from './state.js';

// Load each feature module
import { initControls, getWeights } from './controls.js';


initControls(() => {
    onWeightsChange(getWeights());
    console.log('UPDATE: weights changed!!!');
});

// Non-finished modules
import { initGlobe } from './globe.js';
import { initCityCard } from './cityCard.js';
import { initComparison } from './comparison.js';

const cities = await d3.json('data/cities.json');

initState(cities);
initGlobe();
initControls();
initCityCard();
initComparison();