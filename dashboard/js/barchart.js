
import { CITY_COLORS} from './colors.js';

// ============================================================
//  STEP 1 — CONFIGURATION
// ============================================================

const CONFIG = {
    // -- Placeholder -----------------------------------------
    PLACEHOLDER_TEXT: 'Select at least 2 cities on the globe and 1 attribute to compare',

    // -- Bar Chart ------------------------------------------
    CHART_HEIGHT: 300,
    MARGIN: { TOP: 10, RIGHT: 10, BOTTOM: 20, LEFT: 35 },
    BAR_PADDING: 0,
    BAR_COLOR: "steelblue",
    BAR_RADIUS: 3,

    // Axes
    Y_TICKS: 5,
    X_TICK_SIZE: 0,
    //X_LABEL_DY: "1.2em",
    //X_LABEL_SIZE: "12px",

    // Title
    TITLE_SIZE: "13px",
    TITLE_WEIGHT: "bold",

    // Container
    CHARTS_ID: "comparison-histogram",

    // Tooltip
    TOOLTIP_OFFSET_X: 12,
    TOOLTIP_OFFSET_Y: 28,
};





const tooltip = d3.select("body").append("div")
    .attr("class", "bar-tooltip")
    .style("opacity", 0);  





function _drawBarChart(data, attribute, width, height, targetEl) {
    const meta = ATTRIBUTES[attribute] ?? {};

    // --- Derived dimensions ---
    const innerWidth = width - CONFIG.MARGIN.LEFT - CONFIG.MARGIN.RIGHT;
    const innerHeight = height - CONFIG.MARGIN.TOP - CONFIG.MARGIN.BOTTOM;

    // --- SVG + inner group ---
    const svg = d3.select(targetEl)
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const g = svg.append("g")
        .attr("transform", `translate(${CONFIG.MARGIN.LEFT}, ${CONFIG.MARGIN.TOP})`);

    // --- Scales ---
    const x = d3.scaleBand()
        .domain(data.map(d => d.city))
        .range([0, innerWidth])
        .padding(CONFIG.BAR_PADDING);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d[attribute])])
        .nice()
        .range([innerHeight, 0]);

    // Color lookup: maps each city name to its color by position in the x domain
    const colorForCity = city => {
        const i = x.domain().indexOf(city);
        return CITY_COLORS[i % CITY_COLORS.length];
    };

    // --- Axes ---
    g.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(x).tickSize(CONFIG.X_TICK_SIZE))
        .selectAll(".tick text").remove();

    g.append("g")
        .call(d3.axisLeft(y).ticks(CONFIG.Y_TICKS));

    // --- Bars ---
    g.selectAll("rect")
        .data(data)
        .join("rect")
        .attr("x", d => x(d.city))
        .attr("y", d => y(d[attribute]))
        .attr("width", x.bandwidth())
        .attr("height", d => innerHeight - y(d[attribute]))
        .attr("fill", d => colorForCity(d.city))
        .attr("rx", CONFIG.BAR_RADIUS)
        .on("mouseover", (event, d) => {
            tooltip
                .style("opacity", 1)
                .html(`<strong>${d.city}</strong>: ${d[attribute].toFixed(1)}${meta.unit_measure_short ?? ''}`);
        })
        .on("mousemove", (event) => {
            const tooltipNode = tooltip.node();
            const tooltipWidth = tooltipNode.offsetWidth;
            const tooltipHeight = tooltipNode.offsetHeight;

            const pageWidth = window.innerWidth;
            const pageHeight = window.innerHeight;

            // If tooltip would overflow the right edge, flip it to the left of the cursor
            const left = (event.pageX + CONFIG.TOOLTIP_OFFSET_X + tooltipWidth > pageWidth)
                ? event.pageX - tooltipWidth - CONFIG.TOOLTIP_OFFSET_X
                : event.pageX + CONFIG.TOOLTIP_OFFSET_X;

            // If tooltip would overflow the bottom edge, flip it above the cursor
            const top = (event.pageY + CONFIG.TOOLTIP_OFFSET_Y + tooltipHeight > pageHeight)
                ? event.pageY - tooltipHeight - CONFIG.TOOLTIP_OFFSET_Y
                : event.pageY + CONFIG.TOOLTIP_OFFSET_Y;

            tooltip
                .style("left", left + "px")
                .style("top", top + "px");
        })
        .on("mouseout", () => {
            tooltip.style("opacity", 0);
        });

    // --- Title ---
    //svg.append("text")
    //    .attr("x", width / 2)
    //    .attr("y", height - 35)
    //    .attr("text-anchor", "middle")
    //    .style("font-size", CONFIG.TITLE_SIZE)
    //    .style("font-weight", CONFIG.TITLE_WEIGHT)
    //    .text(attr);
}











// ============================================================
//  STEP 3 — INITIALISE
//  Call once from main.js after the DOM is ready.
// ============================================================

// Handling attributes
let ATTRIBUTES = {};

export function initBarChart(attributes) {
    ATTRIBUTES = attributes;
    _renderPlaceholder('comparison-histogram');
}




// ============================================================
//  STEP 5 — PLACEHOLDER
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



// ============================================================
//  STEP 5 — RENDER BAR CHART
// ============================================================


export function barchart_render(data, selectedCities, selectedAttrs) {
    // --- Clear previous charts ---
    // Every time render is called we start from scratch.
    // This is simpler than trying to update existing SVGs in place,
    // since the number of charts can change entirely.
    d3.select(`#${CONFIG.CHARTS_ID}`).selectAll("*").remove();

    // --- Guard: nothing to draw ---
    if (selectedCities.length < 2 || selectedAttrs.length < 1) {
        _renderPlaceholder(CONFIG.CHARTS_ID);
        return;
    }

    // --- Compute per-chart width ---
    // The container width is divided equally among all charts.
    // clientWidth reads the actual rendered width of the flex container,
    // so this automatically adapts if the window is resized.
    const container = document.getElementById(CONFIG.CHARTS_ID);
    const containerWidth = container.clientWidth;
    const chartWidth = containerWidth / selectedAttrs.length;
    const chartHeight = container.clientHeight;

    // --- Filter data to selected cities ---
    // We do this once here rather than inside _drawBarChart,
    // so the function receives only what it needs to draw.
    const filteredData = selectedCities.map(city => data.find(d => d.city === city)).filter(Boolean);

    // --- Draw one chart per selected attribute ---
    // Each chart shares the same filtered city data but has its own y scale.
    //selectedAttrs.forEach(attr => {
    //    _drawBarChart(filteredData, attr, chartWidth);
    //});

    selectedAttrs.forEach(attribute => {
        const meta = ATTRIBUTES[attribute] ?? {};

        const wrapper = document.createElement('div');
        wrapper.className = 'city-barchart-wrapper';
        wrapper.style.width = `${100 / selectedAttrs.length}%`;

        const label = document.createElement('div');
        label.className = 'city-barchart-label';
        label.textContent = meta.name ?? attribute;
        label.title = meta.description ?? meta.name ?? attribute;

        container.appendChild(wrapper);
        _drawBarChart(filteredData, attribute, chartWidth, chartHeight, wrapper);
        wrapper.appendChild(label);
    });
}

