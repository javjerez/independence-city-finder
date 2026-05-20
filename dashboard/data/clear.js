const fs = require("fs");

const data = JSON.parse(
  fs.readFileSync("columns_dataset.json", "utf8")
);

fs.writeFileSync(
  "pretty_columns_dataset.json",
  JSON.stringify(data, null, 2)
);

// DEBUGGING ATTRIBUTES
// 'group': groups attributes (for future filtering or styling)

/*
//export const ATTRIBUTES = [
//  { attribute: 'housing', label: 'Housing' },
//  { attribute: 'cost_of_living', label: 'Cost of Living' },
//  { attribute: 'startups', label: 'Startups' },
//  { attribute: 'venture_capital', label: 'Venture Capital' },
//  { attribute: 'travel_connectivity', label: 'Travel Connectivity' },
//  { attribute: 'commute', label: 'Commute' },
//  { attribute: 'business_freedom', label: 'Business Freedom' },
//  { attribute: 'safety', label: 'Safety' },
//  { attribute: 'healthcare', label: 'Healthcare' },
//  { attribute: 'education', label: 'Education' },
//  { attribute: 'environmental_quality', label: 'Environmental Quality' },
//  { attribute: 'economy', label: 'Economy' },
//  { attribute: 'taxation', label: 'Taxation' },
//  { attribute: 'internet_access', label: 'Internet Access' },
//  { attribute: 'leisure_&_culture', label: 'Leisure & Culture' },
//  { attribute: 'tolerance', label: 'Tolerance' },
//  { attribute: 'outdoors', label: 'Outdoors' },
//
//  // Extra datasets
//  // { attribute: 'population', label: 'Population' },
//  // { attribute: 'mcmeal_combo', label: 'McMeal Price' },
//  { attribute: 'avg_monthly_net_salary', label: 'Monthly Salary' },
//  // { attribute: 'internet_60mbps', label: 'Internet 60Mbps Price' },
//
//  // Sunshine
//  { attribute: 'sun_year', label: 'Yearly Sunshine' }
//  // { attribute: 'temp_year', label: 'Yearly Temperature' }
//];
*/

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
