/**
 * globe.js — D3 Interactive Rotating Globe
 * ==========================================
 * Self-contained D3 globe that:
 *   - Renders a draggable orthographic globe
 *   - Highlights clicked countries
 *   - Fires a postMessage to the parent window with the selected ISO alpha-3 code
 *
 * Usage (standalone HTML):
 *   Load this script in globe.html (see below).
 *   The parent page (Bokeh dashboard) listens for:
 *     window.addEventListener("message", e => {
 *         if (e.data.type === "countrySelect") console.log(e.data.iso3);
 *     });
 *
 * Dependencies (loaded via CDN in globe.html):
 *   - D3 v7   (d3.min.js)
 *   - TopoJSON (topojson.min.js)
 *
 * Data source:
 *   World topology: https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json
 *   ISO numeric → alpha-3 mapping is embedded in ISO_NUM_TO_A3 below.
 */

// ─────────────────────────────────────────────
// ISO NUMERIC (TopoJSON feature id) → ALPHA-3
// Extend this map when you add more countries.
// ─────────────────────────────────────────────
const ISO_NUM_TO_A3 = {
    "4":   "AFG", "8":   "ALB", "12":  "DZA", "24":  "AGO",
    "32":  "ARG", "36":  "AUS", "40":  "AUT", "50":  "BGD",
    "56":  "BEL", "64":  "BTN", "68":  "BOL", "76":  "BRA",
    "100": "BGR", "116": "KHM", "120": "CMR", "124": "CAN",
    "144": "LKA", "152": "CHL", "156": "CHN", "170": "COL",
    "178": "COG", "188": "CRI", "191": "HRV", "192": "CUB",
    "196": "CYP", "203": "CZE", "204": "BEN", "208": "DNK",
    "218": "ECU", "818": "EGY", "231": "ETH", "246": "FIN",
    "250": "FRA", "266": "GAB", "276": "DEU", "288": "GHA",
    "300": "GRC", "320": "GTM", "332": "HTI", "340": "HND",
    "348": "HUN", "356": "IND", "360": "IDN", "364": "IRN",
    "368": "IRQ", "372": "IRL", "376": "ISR", "380": "ITA",
    "388": "JAM", "392": "JPN", "400": "JOR", "398": "KAZ",
    "404": "KEN", "410": "KOR", "408": "PRK", "414": "KWT",
    "418": "LAO", "422": "LBN", "430": "LBR", "434": "LBY",
    "440": "LTU", "442": "LUX", "484": "MEX", "504": "MAR",
    "508": "MOZ", "516": "NAM", "524": "NPL", "528": "NLD",
    "540": "NCL", "554": "NZL", "566": "NGA", "578": "NOR",
    "586": "PAK", "591": "PAN", "598": "PNG", "604": "PER",
    "608": "PHL", "616": "POL", "620": "PRT", "630": "PRI",
    "634": "QAT", "642": "ROU", "643": "RUS", "646": "RWA",
    "682": "SAU", "694": "SLE", "703": "SVK", "705": "SVN",
    "706": "SOM", "710": "ZAF", "724": "ESP", "144": "LKA",
    "729": "SDN", "752": "SWE", "756": "CHE", "760": "SYR",
    "158": "TWN", "762": "TJK", "764": "THA", "768": "TGO",
    "780": "TTO", "788": "TUN", "792": "TUR", "800": "UGA",
    "804": "UKR", "784": "ARE", "826": "GBR", "840": "USA",
    "858": "URY", "860": "UZB", "862": "VEN", "704": "VNM",
    "887": "YEM", "894": "ZMB", "716": "ZWE", "702": "SGP",
    "388": "JAM",
};

// ─────────────────────────────────────────────
// THEME  (reads prefers-color-scheme)
// ─────────────────────────────────────────────
const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

const COLORS = {
    ocean:      isDark ? "#0d1f2d" : "#ddeef7",
    land:       isDark ? "#2a3830" : "#d4e8da",
    landHover:  isDark ? "#2d6e52" : "#5DCAA5",
    landSelect: isDark ? "#1a5c42" : "#1D9E75",
    border:     isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)",
    graticule:  isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    tooltip: {
        bg:   isDark ? "rgba(20,30,25,0.92)" : "rgba(255,255,255,0.95)",
        text: isDark ? "#e0e0e0" : "#2C2C2A",
    },
};

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let selectedNumericId = null;   // currently selected TopoJSON feature id
let rotation = [0, -20];        // [lambda, phi] — current globe rotation
let dragStart = null;           // mouse position when drag began


// ─────────────────────────────────────────────
// INIT — called once the DOM is ready
// ─────────────────────────────────────────────
function initGlobe() {
    const container = document.getElementById("globe-container");
    const W = container.clientWidth;
    const H = container.clientHeight;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) * 0.44;

    // ── Projection ──────────────────────────
    const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([cx, cy])
        .clipAngle(90)
        .rotate(rotation);

    const pathGenerator = d3.geoPath(projection);

    // ── SVG ─────────────────────────────────
    const svg = d3.select("#globe-container")
        .append("svg")
        .attr("width", W)
        .attr("height", H)
        .style("display", "block")
        .style("cursor", "grab");

    // Ocean sphere
    svg.append("circle")
        .attr("cx", cx).attr("cy", cy).attr("r", radius)
        .attr("fill", COLORS.ocean);

    // Root group (everything inside rotates together)
    const rootG = svg.append("g");

    // Graticule (lat/lon grid)
    const graticule = d3.geoGraticule()();
    const graticulePath = rootG.append("path")
        .datum(graticule)
        .attr("class", "graticule")
        .attr("fill", "none")
        .attr("stroke", COLORS.graticule)
        .attr("stroke-width", 0.5)
        .attr("d", pathGenerator);

    // Country paths group
    const countriesG = rootG.append("g").attr("class", "countries");

    // Sphere outline (drawn on top)
    const sphereOutline = svg.append("path")
        .datum({ type: "Sphere" })
        .attr("fill", "none")
        .attr("stroke", COLORS.border)
        .attr("stroke-width", 0.8)
        .attr("d", pathGenerator);

    // ── Tooltip ──────────────────────────────
    const tooltip = d3.select("#globe-container")
        .append("div")
        .attr("id", "globe-tooltip")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", COLORS.tooltip.bg)
        .style("border", "0.5px solid rgba(0,0,0,0.15)")
        .style("border-radius", "6px")
        .style("padding", "4px 10px")
        .style("font-size", "11px")
        .style("color", COLORS.tooltip.text)
        .style("opacity", "0")
        .style("transition", "opacity 0.15s")
        .style("white-space", "nowrap");

    // ── Redraw helper ────────────────────────
    function redraw() {
        graticulePath.attr("d", pathGenerator);
        countriesG.selectAll("path").attr("d", pathGenerator);
        sphereOutline.attr("d", pathGenerator);
    }

    // ── Load topology ────────────────────────
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
        .then(world => {
            const features = topojson.feature(world, world.objects.countries).features;

            countriesG.selectAll("path")
                .data(features)
                .join("path")
                    .attr("d", pathGenerator)
                    .attr("fill",         d => d.id === selectedNumericId ? COLORS.landSelect : COLORS.land)
                    .attr("stroke",       COLORS.border)
                    .attr("stroke-width", 0.4)
                    .style("cursor",      "pointer")

                    // Hover
                    .on("mouseover", function(event, d) {
                        if (d.id !== selectedNumericId) {
                            d3.select(this).attr("fill", COLORS.landHover);
                        }
                        const name = d.properties?.name || String(d.id);
                        tooltip.style("opacity", "1").text(name);
                    })
                    .on("mousemove", function(event) {
                        const rect = container.getBoundingClientRect();
                        tooltip
                            .style("left",  (event.clientX - rect.left + 14) + "px")
                            .style("top",   (event.clientY - rect.top  - 30) + "px");
                    })
                    .on("mouseout", function(event, d) {
                        d3.select(this).attr("fill",
                            d.id === selectedNumericId ? COLORS.landSelect : COLORS.land
                        );
                        tooltip.style("opacity", "0");
                    })

                    // Click — select country & notify parent
                    .on("click", function(event, d) {
                        event.stopPropagation();

                        // Deselect if clicking the same country again
                        if (d.id === selectedNumericId) {
                            selectedNumericId = null;
                            d3.select(this).attr("fill", COLORS.land);
                            updateSubtitle("drag to rotate · click to select");
                            notifyParent(null);
                            return;
                        }

                        selectedNumericId = d.id;

                        // Update fill for all countries
                        countriesG.selectAll("path")
                            .attr("fill", f => f.id === selectedNumericId ? COLORS.landSelect : COLORS.land);

                        const name = d.properties?.name || String(d.id);
                        updateSubtitle(name);

                        // Convert numeric id → alpha-3 and post to parent
                        const iso3 = ISO_NUM_TO_A3[String(+d.id)];
                        notifyParent(iso3 || null, name);
                    });

            redraw();
        })
        .catch(err => console.error("Failed to load world topology:", err));

    // ── Drag to rotate ───────────────────────
    svg.call(
        d3.drag()
            .on("start", event => {
                dragStart = [event.x, event.y];
                svg.style("cursor", "grabbing");
            })
            .on("drag", event => {
                if (!dragStart) return;
                const dx = event.x - dragStart[0];
                const dy = event.y - dragStart[1];
                rotation[0] += dx * 0.4;
                rotation[1]  = Math.max(-90, Math.min(90, rotation[1] - dy * 0.4));
                projection.rotate(rotation);
                redraw();
                dragStart = [event.x, event.y];
            })
            .on("end", () => {
                dragStart = null;
                svg.style("cursor", "grab");
            })
    );

    // ── Auto-spin (stops on first interaction) ──
    let spinning = true;
    const spinTimer = d3.timer(elapsed => {
        if (!spinning) { spinTimer.stop(); return; }
        rotation[0] += 0.15;
        projection.rotate(rotation);
        redraw();
    });

    svg.on("mousedown.spin", () => { spinning = false; });
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Update the subtitle text below the panel label. */
function updateSubtitle(text) {
    const el = document.getElementById("globe-subtitle");
    if (el) el.textContent = text;
}

/**
 * Notify the parent window (Bokeh dashboard) of a country selection.
 * The parent must listen for window.addEventListener("message", ...).
 *
 * @param {string|null} iso3  ISO 3166-1 alpha-3 code, or null to deselect.
 * @param {string}      name  Human-readable country name (for display).
 */
function notifyParent(iso3, name = "") {
    if (window.parent && window.parent !== window) {
        window.parent.postMessage(
            { type: "countrySelect", iso3, name },
            "*"   // replace "*" with your dashboard origin in production
        );
    }

    // Also dispatch a CustomEvent on the document (useful when globe.js
    // is loaded directly in the same page without an iframe).
    document.dispatchEvent(
        new CustomEvent("globeCountrySelect", { detail: { iso3, name } })
    );
}

// ─────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGlobe);
} else {
    initGlobe();
}
