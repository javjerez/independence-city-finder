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

import { initGlobe } from './globe.js';

// Non-finished modules
import { initCityCard } from './cityCard.js';
import { initComparison } from './comparison.js';

// Load the data and initialize the app
const cities = await d3.json('data/pretty_columns_dataset.json');
//const cities = await d3.json('data/cities_dataset.json');
//const cities = await d3.json('data/columns_dataset.json');

initState(cities);
initGlobe(cities);
initCityCard();
initComparison();
