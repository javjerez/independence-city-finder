import { CITY_COLORS} from './colors.js';



// CONFIGURATION

const CONFIG = {
    // Placeholder
    PLACEHOLDER_TEXT: 'Select a cities on the globe to see their fingerprint',

    // Radar Chart
    CHART_SIZE: 300,            // total SVG width & height (square)
    RADAR_PADDING: 7,          // space reserved around the radar for labels
    GRID_LEVELS: 3,             // number of concentric grid rings
    CURVE: d3.curveCardinalClosed.tension(0.2),  // smoothing — raise for rounder, lower for pointier

    // Labels
    LABEL_MAX_LENGTH: 18,       // truncate attribute names longer than this

    // Title (city name)
    TITLE_FONT_SIZE: "12px",
    TITLE_FONT_WEIGHT: "bold",
    TITLE_COLOR: "#222",
    TITLE_OFFSET_Y: 0,         // distance above chart area

    // Container
    CHARTS_ID: "comparison-radar",
    
    TOOLTIP_OFFSET_X: 12,
    TOOLTIP_OFFSET_Y: 28,

    HOVER_SLIDE_HITBOX_FRACTION: 0.5, // 1.0 = full width, lower = narrower
};



// TOOLTIP (shared across all radar charts in the container)

const _tooltip = d3.select("body").append("div")
    .attr("class", "radar-tooltip")
    .style("opacity", 0);



// INTERNAL HELPERS

/**
 * Convert polar coordinates to Cartesian
 * angle 0 = top (12 o'clock), increases clockwise
 */
function _polarToXY(angle, radius) {
    return {
        x: radius * Math.sin(angle),
        y: -radius * Math.cos(angle),
    };
}

/**
 * Clamp and truncate an attribute name for display
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



// STEP 3 — INITIALISE (call once from main.js after the DOM is ready)

// Handling attributes
let ATTRIBUTES = {};

export function initRadarChart(attributes) {
    ATTRIBUTES = attributes;
    _renderPlaceholder(CONFIG.CHARTS_ID);
}



// PLACEHOLDER

function _renderPlaceholder(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';

    const msg = document.createElement('div');
    msg.className = 'comparison-placeholder';
    msg.textContent = CONFIG.PLACEHOLDER_TEXT;
    el.appendChild(msg);
}

export function radar_render(
    data,
    cities,
    norms,
    excludedAttrs = CONFIG.DEFAULT_EXCLUDED_ATTRS
) {
    d3.select(`#${CONFIG.CHARTS_ID}`).selectAll("*").remove();

    if (!cities || cities.length < 1) {
        _renderPlaceholder(CONFIG.CHARTS_ID);
        return;
    }

    const attrs = _resolveAttrs(data, excludedAttrs);
    const filteredData = data.filter(d => cities.includes(d.city));
    const container = document.getElementById(CONFIG.CHARTS_ID);
    const maxHeight = parseFloat(getComputedStyle(container).maxHeight);

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

        const color = CITY_COLORS[i % CITY_COLORS.length];

        const wrapper = document.createElement('div');
        wrapper.className = `city-radar-wrapper`;
        wrapper.style.width = `${100 / cities.length}%`;

        const label = document.createElement('div');
        label.className = 'city-radar-label';
        label.textContent = cityName;
        label.style.color = color;

        wrapper.appendChild(label);
        container.appendChild(wrapper);

        const size = Math.min(wrapper.clientWidth, maxHeight - 24);
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

    // Concentric grid rings
    const gridGroup = g.append("g").attr("class", "radar-grid");
    d3.range(1, CONFIG.GRID_LEVELS + 1).forEach(level => {
        gridGroup.append("circle")
            .attr("class", "radar-grid-ring")
            .attr("r", radarR * (level / CONFIG.GRID_LEVELS));
    });

    // Axis spokes
    const axisGroup = g.append("g").attr("class", "radar-axes");
    normValues.forEach((_, i) => {
        const { x, y } = _polarToXY(angleSlice * i, radarR);
        axisGroup.append("line")
            .attr("class", "radar-axis")
            .attr("x1", 0).attr("y1", 0)
            .attr("x2", x).attr("y2", y);
    });

    // Blob path
    const radarLine = d3.lineRadial()
        .curve(CONFIG.CURVE)
        .radius((_, i) => normValues[i] * radarR)
        .angle((_, i) => angleSlice * i);

    g.append("g").attr("class", "radar-blob")
        .append("path")
        .attr("class", "radar-blob-path")
        .datum(normValues.map((_, i) => i))
        .attr("d", radarLine)
        .attr("fill", color)
        .attr("stroke", color);

    // Hover wedges
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
