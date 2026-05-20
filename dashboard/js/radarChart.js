// ============================================================
//  STEP 1 — CONFIGURATION
// ============================================================

const CONFIG = {

    // -- Shared colors — index 0 = primary, 1–4 = compared ----
    CITY_COLORS: [
        '#ff6b35',   // primary
        '#ffd700',   // compared 1
        '#00bfff',   // compared 2
        '#7fff00',   // compared 3
        '#ff69b4',   // compared 4
    ],

    // -- Placeholder ------------------------------------------
    PLACEHOLDER_TEXT: 'Select at least 2 cities on the globe to compare their fingerprints',

    // -- Radar Chart -----------------------------------------
    CHART_SIZE: 300,            // total SVG width & height (square)
    RADAR_PADDING: 7,          // space reserved around the radar for labels
    GRID_LEVELS: 3,             // number of concentric grid rings
    CURVE: d3.curveCardinalClosed.tension(0.2),  // smoothing — raise for rounder, lower for pointier

    // Axes
    AXIS_COLOR: "#ccc",
    AXIS_STROKE_WIDTH: 0.35,

    // Grid
    GRID_COLOR: "#e0e0e0",
    GRID_STROKE_WIDTH: 0.35,
    GRID_STROKE_DASH: "3,6",

    // Blob (the filled shape)
    BLOB_STROKE_WIDTH: 3,
    BLOB_FILL_OPACITY: 0.4,
    BLOB_STROKE_OPACITY: 0.9,

    // Dot on each axis spoke
    DOT_RADIUS: 1.5,
    DOT_STROKE_WIDTH: 3,

    // Labels
    LABEL_FONT_SIZE: "9.5px",
    LABEL_FONT_FAMILY: "sans-serif",
    LABEL_COLOR: "#444",
    LABEL_MAX_LENGTH: 18,       // truncate attribute names longer than this

    // Title (city name)
    TITLE_FONT_SIZE: "12px",
    TITLE_FONT_WEIGHT: "bold",
    TITLE_COLOR: "#222",
    TITLE_OFFSET_Y: 0,         // distance above chart area

    // Container
    CHARTS_ID: "comparison-radar",

    // Tooltip
    TOOLTIP_FONT_SIZE: "12px",
    TOOLTIP_PADDING: "6px 10px",
    TOOLTIP_BORDER: "1px solid #ccc",
    TOOLTIP_BORDER_RADIUS: "4px",
    TOOLTIP_OFFSET_X: 12,
    TOOLTIP_OFFSET_Y: 28,

    HOVER_SLIDE_HITBOX_FRACTION: 0.5, // 1.0 = full width, lower = narrower
};


// ============================================================
//  TOOLTIP (shared across all radar charts in the container)
// ============================================================

const _tooltip = d3.select("body").append("div")
    .style("position", "absolute")
    .style("background", "white")
    .style("border", CONFIG.TOOLTIP_BORDER)
    .style("border-radius", CONFIG.TOOLTIP_BORDER_RADIUS)
    .style("padding", CONFIG.TOOLTIP_PADDING)
    .style("font-size", CONFIG.TOOLTIP_FONT_SIZE)
    .style("pointer-events", "none")
    .style("opacity", 0);


// ============================================================
//  INTERNAL HELPERS
// ============================================================

/**
 * Convert polar coordinates to Cartesian.
 * angle 0 = top (12 o'clock), increases clockwise.
 */
function _polarToXY(angle, radius) {
    return {
        x: radius * Math.sin(angle),
        y: -radius * Math.cos(angle),
    };
}

/**
 * Clamp and truncate an attribute name for display.
 */
function _labelText(attr) {
    const pretty = attr.replace(/_/g, ' ');
    return pretty.length > CONFIG.LABEL_MAX_LENGTH
        ? pretty.slice(0, CONFIG.LABEL_MAX_LENGTH - 1) + '…'
        : pretty;
}

/**
 * Compute global min/max for every numeric attribute across the full dataset.
 * Returns a Map: attr → { min, max }
 */
function _globalNorms(data, attrs) {
    const norms = new Map();
    attrs.forEach(attr => {
        const values = data.map(d => +d[attr]).filter(v => isFinite(v));
        norms.set(attr, {
            min: d3.min(values),
            max: d3.max(values),
        });
    });
    return norms;
}

/**
 * Normalise a raw value to [0, 1] using global min/max.
 * Returns 0 if min === max (degenerate attribute).
 */
function _norm(value, min, max, invert = false) {
    if (max === min) return 0;
    const v = Math.max(0, Math.min(1, (+value - min) / (max - min)));
    return invert ? 1 - v : v;
}

/**
 * Resolve which attributes to plot:
 *   – keep only numeric columns present in every city row
 *   – remove CONFIG.DEFAULT_EXCLUDED_ATTRS + caller-supplied excludedAttrs
 */
function _resolveAttrs(data, extraExcluded = []) {
    const excluded = new Set(extraExcluded.map(s => s.toLowerCase()));

    return Object.entries(ATTRIBUTES)
        .filter(([key, meta]) => {
            if (excluded.has(key.toLowerCase())) return false;
            if (meta.visualize === false) return false;

            return data.some(d =>
                d[key] !== null &&
                d[key] !== '' &&
                isFinite(+d[key])
            );
        })
        .map(([key]) => key);
}


//// ============================================================
////  CORE DRAWING FUNCTION
//// ============================================================
//
///**
// * Draw a single round radar / fingerprint for one city.
// *
// * @param {object}  cityRow   — single data object for the city
// * @param {string}  cityColor — hex fill/stroke colour
// * @param {string[]} attrs    — ordered list of attribute keys to plot
// * @param {Map}     norms     — global normalisation ranges
// * @param {number}  size      — SVG side length in px
// */
//
//
////function _drawRadar(cityRow, cityColor, attrs, norms, size) {
//function _drawRadar(cityRow, cityColor, attrs, norms, size, targetEl) {
//    const n = attrs.length;
//    if (n < 3) return; // radar needs at least 3 axes
//
//    const radarR = (size - 2 * CONFIG.RADAR_PADDING) / 2;   // radius of the full ring
//    const cx = size / 2;
//    const cy = size / 2 + CONFIG.TITLE_OFFSET_Y / 2;    // shift down slightly for title
//
//    const angleSlice = (2 * Math.PI) / n;
//
//    // --- SVG ---
//    //const svg = d3.select(`#${CONFIG.CHARTS_ID}`)
//    const svg = d3.select(targetEl)
//        .append("svg")
//        .attr("width", size)
//        .attr("height", size)
//        .style("flex-shrink", "1")   // participate in flex layout
//        .style("min-width", "0");
//
//
//    const g = svg.append("g")
//        .attr("transform", `translate(${cx}, ${cy})`);
//
//    // --- Concentric grid rings (circular, not polygon) ---
//    const gridGroup = g.append("g").attr("class", "radar-grid");
//
//    d3.range(1, CONFIG.GRID_LEVELS + 1).forEach(level => {
//        const r = radarR * (level / CONFIG.GRID_LEVELS);
//        gridGroup.append("circle")
//            .attr("r", r)
//            .attr("fill", "none")
//            .attr("stroke", CONFIG.GRID_COLOR)
//            .attr("stroke-width", CONFIG.GRID_STROKE_WIDTH)
//            .attr("stroke-dasharray", CONFIG.GRID_STROKE_DASH);
//    });
//
//    // --- Axis spokes ---
//    const axisGroup = g.append("g").attr("class", "radar-axes");
//
//    attrs.forEach((attr, i) => {
//        const angle = angleSlice * i;
//        const { x, y } = _polarToXY(angle, radarR);
//
//        axisGroup.append("line")
//            .attr("x1", 0).attr("y1", 0)
//            .attr("x2", x).attr("y2", y)
//            .attr("stroke", CONFIG.AXIS_COLOR)
//            .attr("stroke-width", CONFIG.AXIS_STROKE_WIDTH);
//    });
//
//    // --- Axis labels ---
//    //const labelGroup = g.append("g").attr("class", "radar-labels");
//    //const LABEL_R = radarR + 14;   // push labels just beyond the outermost ring
//    //
//    //attrs.forEach((attr, i) => {
//    //    const angle = angleSlice * i;
//    //    const { x, y } = _polarToXY(angle, LABEL_R);
//    //
//    //    // Anchor: left side → "end", right side → "start", top/bottom → "middle"
//    //    const sinA = Math.sin(angle);
//    //    const anchor = Math.abs(sinA) < 0.1 ? "middle"
//    //        : sinA > 0 ? "start"
//    //            : "end";
//    //
//    //    // Vertical baseline nudge for top/bottom labels
//    //    const dominantBaseline = Math.cos(angle) > 0.85 ? "auto"
//    //        : Math.cos(angle) < -0.85 ? "hanging"
//    //            : "middle";
//    //
//    //    labelGroup.append("text")
//    //        .attr("x", x)
//    //        .attr("y", y)
//    //        .attr("text-anchor", anchor)
//    //        .attr("dominant-baseline", dominantBaseline)
//    //        .style("font-size", CONFIG.LABEL_FONT_SIZE)
//    //        .style("font-family", CONFIG.LABEL_FONT_FAMILY)
//    //        .style("fill", CONFIG.LABEL_COLOR)
//    //        .text(_labelText(attr));
//    //});
//
//    // --- Blob path (smooth, closed) ---
//    // Compute normalised radius for each axis
//    const points = attrs.map((attr, i) => {
//        const { min, max } = norms.get(attr);
//        const normVal = _norm(cityRow[attr], min, max);
//        const r = normVal * radarR;
//        const angle = angleSlice * i;
//        return _polarToXY(angle, r);
//    });
//
//    // Build the line generator with the chosen curve
//    const radarLine = d3.lineRadial()
//        .curve(CONFIG.CURVE)
//        .radius((_, i) => {
//            const attr = attrs[i];
//            const { min, max } = norms.get(attr);
//            return _norm(cityRow[attr], min, max) * radarR;
//        })
//        .angle((_, i) => angleSlice * i);
//
//    // lineRadial takes an array indexed 0..n-1
//    const blobData = attrs.map((_, i) => i);
//
//    const blobGroup = g.append("g").attr("class", "radar-blob");
//
//    // Filled area
//    blobGroup.append("path")
//        .datum(blobData)
//        .attr("d", radarLine)
//        .attr("fill", cityColor)
//        .attr("fill-opacity", CONFIG.BLOB_FILL_OPACITY)
//        .attr("stroke", cityColor)
//        .attr("stroke-width", CONFIG.BLOB_STROKE_WIDTH)
//        .attr("stroke-opacity", CONFIG.BLOB_STROKE_OPACITY);
//
//    // --- Dots at each axis intersection ---
//    const dotGroup = g.append("g").attr("class", "radar-dots");
//
//    attrs.forEach((attr, i) => {
//        const { min, max } = norms.get(attr);
//        const normVal = _norm(cityRow[attr], min, max);
//        const r = normVal * radarR;
//        const angle = angleSlice * i;
//        const { x, y } = _polarToXY(angle, r);
//        const rawVal = cityRow[attr];
//
//        dotGroup.append("circle")
//            .attr("cx", x)
//            .attr("cy", y)
//            .attr("r", CONFIG.DOT_RADIUS)
//            .attr("fill", "white")
//            .attr("stroke", cityColor)
//            .attr("stroke-width", CONFIG.DOT_STROKE_WIDTH)
//            .style("cursor", "default")
//            .on("mouseover", (event) => {
//                _tooltip
//                    .style("opacity", 1)
//                    .html(`<strong>${_labelText(attr)}</strong><br>` +
//                        `${cityRow.city}<br>` +
//                        `Value: ${isFinite(+rawVal) ? (+rawVal).toLocaleString(undefined, { maximumFractionDigits: 2 }) : rawVal}`);
//            })
//            .on("mousemove", (event) => {
//                const node = _tooltip.node();
//                const tw = node.offsetWidth;
//                const th = node.offsetHeight;
//                const left = event.pageX + CONFIG.TOOLTIP_OFFSET_X + tw > window.innerWidth
//                    ? event.pageX - tw - CONFIG.TOOLTIP_OFFSET_X
//                    : event.pageX + CONFIG.TOOLTIP_OFFSET_X;
//                const top = event.pageY + CONFIG.TOOLTIP_OFFSET_Y + th > window.innerHeight
//                    ? event.pageY - th - CONFIG.TOOLTIP_OFFSET_Y
//                    : event.pageY + CONFIG.TOOLTIP_OFFSET_Y;
//                _tooltip.style("left", left + "px").style("top", top + "px");
//            })
//            .on("mouseout", () => _tooltip.style("opacity", 0));
//    });
//
//    // --- City title (below axes, inside bottom padding) ---
//    //svg.append("text")
//    //    .attr("x", cx)
//    //    .attr("y", size - CONFIG.TITLE_OFFSET_Y / 2)
//    //    .attr("text-anchor", "middle")
//    //    .style("font-size", CONFIG.TITLE_FONT_SIZE)
//    //    .style("font-weight", CONFIG.TITLE_FONT_WEIGHT)
//    //    .style("fill", cityColor)
//    //    .text(cityRow.city);
//}





// ============================================================
//  STEP 3 — INITIALISE
//  Call once from main.js after the DOM is ready.
// ============================================================

// Handling attributes
let ATTRIBUTES = {};

export function initRadarChart(attributes) {
    ATTRIBUTES = attributes;
    _renderPlaceholder(CONFIG.CHARTS_ID);
}

// ============================================================
//  PLACEHOLDER
// ============================================================

function _renderPlaceholder(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';

    const msg = document.createElement('div');
    msg.className = 'comparison-placeholder';
    msg.textContent = CONFIG.PLACEHOLDER_TEXT;
    el.appendChild(msg);
}


//// ============================================================
////  STEP 5 — RENDER RADAR CHARTS
////
////  API mirrors barchart_render exactly:
////
////    radar_render(data, selectedCities, excludedAttrs)
////
////  @param {object[]} data           — full dataset (all cities, all attributes)
////  @param {string[]} selectedCities — city names to plot (up to 5)
////  @param {string[]} excludedAttrs  — extra attribute keys to suppress
////                                     (on top of the built-in exclusions
////                                     like latitude, longitude, etc.)
//// ============================================================
//export function radar_render(data, cities, norms, excludedAttrs = CONFIG.DEFAULT_EXCLUDED_ATTRS) {
//
//    d3.select(`#${CONFIG.CHARTS_ID}`).selectAll("*").remove();
//
//    if (!cities || cities.length < 2) {
//        _renderPlaceholder(CONFIG.CHARTS_ID);
//        return;
//    }
//
//    const attrs = _resolveAttrs(data, excludedAttrs);
//    if (attrs.length < 3) {
//        console.warn("radar_render: fewer than 3 plottable attributes — skipping render.");
//        _renderPlaceholder(CONFIG.CHARTS_ID);
//        return;
//    }
//
//    // --- Filter to selected cities first, then normalise only over them ---
//    const filteredData = data.filter(d => cities.includes(d.city));
//    const norms = _globalNorms(filteredData, attrs);
//
//    const container = document.getElementById(CONFIG.CHARTS_ID);
//    //const containerWidth = container.clientWidth;
//    //const availablePerChart = containerWidth / cities.length;
//    //const size = Math.min(availablePerChart, CONFIG.CHART_SIZE);
//    const containerWidth = container.clientWidth;
//    const containerHeight = container.clientHeight;
//    const labelHeight = 24; // approximate space the label takes
//
//    const availablePerChart = containerWidth / cities.length;
//    const availableHeight = containerHeight - labelHeight;
//    const size = Math.min(availablePerChart, availableHeight, CONFIG.CHART_SIZE);
//
//    //cities.forEach((cityName, i) => {
//    //    const cityRow = filteredData.find(d => d.city === cityName);
//    //    if (!cityRow) {
//    //        console.warn(`radar_render: city "${cityName}" not found in data — skipped.`);
//    //        return;
//    //    }
//    //    const color = CONFIG.CITY_COLORS[i % CONFIG.CITY_COLORS.length];
//    //    _drawRadar(cityRow, color, attrs, norms, size);
//    //});
//
//    cities.forEach((cityName, i) => {
//        const cityRow = filteredData.find(d => d.city === cityName);
//        if (!cityRow) {
//            console.warn(`radar_render: city "${cityName}" not found in data — skipped.`);
//            return;
//        }
//        const color = CONFIG.CITY_COLORS[i % CONFIG.CITY_COLORS.length];
//
//        const wrapper = document.createElement('div');
//        const parityClass = cities.length < 3
//            ? 'city-radar-wrapper--even'
//            : (i % 2 === 0 ? 'city-radar-wrapper--even' : 'city-radar-wrapper--odd');
//        wrapper.className = `city-radar-wrapper ${parityClass}`;
//        wrapper.style.width = `${100 / cities.length}%`;
//
//        const label = document.createElement('div');
//        label.className = 'city-radar-label';
//        label.textContent = cityName;
//        label.style.color = color;
//
//        wrapper.appendChild(label);
//        container.appendChild(wrapper);
//
//        _drawRadar(cityRow, color, attrs, size, wrapper);
//    });
//}


export function radar_render(
    data,
    cities,
    norms,
    excludedAttrs = CONFIG.DEFAULT_EXCLUDED_ATTRS
) {
    d3.select(`#${CONFIG.CHARTS_ID}`).selectAll("*").remove();

    if (!cities || cities.length < 2) {
        _renderPlaceholder(CONFIG.CHARTS_ID);
        return;
    }

    const attrs = _resolveAttrs(data, excludedAttrs);
    if (attrs.length < 3) {
        console.warn("radar_render: fewer than 3 plottable attributes — skipping render.");
        _renderPlaceholder(CONFIG.CHARTS_ID);
        return;
    }

    const filteredData = data.filter(d => cities.includes(d.city));

    const container = document.getElementById(CONFIG.CHARTS_ID);
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const labelHeight = 24;
    const availablePerChart = containerWidth / cities.length;
    const availableHeight = containerHeight - labelHeight;
    const size = Math.min(availablePerChart, availableHeight, CONFIG.CHART_SIZE);

    cities.forEach((cityName, i) => {
        const cityRow = filteredData.find(d => d.city === cityName);
        if (!cityRow) {
            console.warn(`radar_render: city "${cityName}" not found in data — skipped.`);
            return;
        }

        const normValues = attrs.map(attr => {
            const { min, max } = norms.get(attr);
            const norm = max === min ? 0 : (cityRow[attr] - min) / (max - min);
            return ATTRIBUTES[attr]?.invert ? 1 - norm : norm;
        });

        const color = CONFIG.CITY_COLORS[i % CONFIG.CITY_COLORS.length];

        const wrapper = document.createElement('div');
        const parityClass = cities.length < 3
            ? 'city-radar-wrapper--even'
            : (i % 2 === 0 ? 'city-radar-wrapper--even' : 'city-radar-wrapper--odd');
        wrapper.className = `city-radar-wrapper ${parityClass}`;
        wrapper.style.width = `${100 / cities.length}%`;

        const label = document.createElement('div');
        label.className = 'city-radar-label';
        label.textContent = cityName;
        label.style.color = color;

        wrapper.appendChild(label);
        container.appendChild(wrapper);

        _drawRadar(normValues, attrs, color, size, wrapper);
    });
}



function _drawRadar(normValues, attributeNames, color, size, wrapper) {
    const n = normValues.length;
    if (n < 3) return;

    const radarR = (size - 2 * CONFIG.RADAR_PADDING) / 2;
    const cx = size / 2;
    const cy = size / 2 + CONFIG.TITLE_OFFSET_Y / 2;
    const angleSlice = (2 * Math.PI) / n;

    const svg = d3.select(wrapper)
        .append("svg")
        .attr("width", size)
        .attr("height", size)
        .style("flex-shrink", "1")
        .style("min-width", "0");

    const g = svg.append("g")
        .attr("transform", `translate(${cx}, ${cy})`);

    // --- Concentric grid rings ---
    const gridGroup = g.append("g").attr("class", "radar-grid");
    d3.range(1, CONFIG.GRID_LEVELS + 1).forEach(level => {
        gridGroup.append("circle")
            .attr("r", radarR * (level / CONFIG.GRID_LEVELS))
            .attr("fill", "none")
            .attr("stroke", CONFIG.GRID_COLOR)
            .attr("stroke-width", CONFIG.GRID_STROKE_WIDTH);
    });

    // --- Axis spokes ---
    const axisGroup = g.append("g").attr("class", "radar-axes");
    normValues.forEach((_, i) => {
        const { x, y } = _polarToXY(angleSlice * i, radarR);
        axisGroup.append("line")
            .attr("x1", 0).attr("y1", 0)
            .attr("x2", x).attr("y2", y)
            .attr("stroke", CONFIG.AXIS_COLOR)
            .attr("stroke-width", CONFIG.AXIS_STROKE_WIDTH)
            .attr("stroke-dasharray", CONFIG.GRID_STROKE_DASH);
    });

    // --- Blob path ---
    const radarLine = d3.lineRadial()
        .curve(CONFIG.CURVE)
        .radius((_, i) => normValues[i] * radarR)
        .angle((_, i) => angleSlice * i);

    g.append("g").attr("class", "radar-blob")
        .append("path")
        .datum(normValues.map((_, i) => i))
        .attr("d", radarLine)
        .attr("fill", color)
        .attr("fill-opacity", CONFIG.BLOB_FILL_OPACITY)
        .attr("stroke", color)
        .attr("stroke-width", CONFIG.BLOB_STROKE_WIDTH)
        .attr("stroke-opacity", CONFIG.BLOB_STROKE_OPACITY);

    // --- Hover wedges ---
    const hoverGroup = g.append("g").attr("class", "radar-hover");

    const arc = d3.arc()
        .innerRadius(radarR * 0.3)
        .outerRadius(radarR);

    const sliceFraction = CONFIG.HOVER_SLIDE_HITBOX_FRACTION;
    const halfSlice = (angleSlice * sliceFraction) / 2;

    normValues.forEach((val, i) => {
        const meta = ATTRIBUTES[attributeNames[i]] ?? attributeNames[i];

        const midAngle = angleSlice * i;
        hoverGroup.append("path")
            .attr("d", arc({
                startAngle: midAngle - halfSlice,
                endAngle: midAngle + halfSlice
            }))
            .attr("fill", "transparent")
            .style("cursor", "default")
            .on("mouseover", (event) => {
                _tooltip
                    .style("opacity", 1)
                    .html(`<strong>${meta.name ?? attributeNames[i]}</strong><br>Score: ${(val * 100).toFixed(1)}/100`);
            })
            .on("mousemove", (event) => {
                const node = _tooltip.node();
                const tw = node.offsetWidth;
                const th = node.offsetHeight;
                const left = event.pageX + CONFIG.TOOLTIP_OFFSET_X + tw > window.innerWidth
                    ? event.pageX - tw - CONFIG.TOOLTIP_OFFSET_X
                    : event.pageX + CONFIG.TOOLTIP_OFFSET_X;
                const top = event.pageY + CONFIG.TOOLTIP_OFFSET_Y + th > window.innerHeight
                    ? event.pageY - th - CONFIG.TOOLTIP_OFFSET_Y
                    : event.pageY + CONFIG.TOOLTIP_OFFSET_Y;
                _tooltip.style("left", left + "px").style("top", top + "px");
            })
            .on("mouseout", () => _tooltip.style("opacity", 0));
    });
}