/**
 * globe.js — D3 Interactive Rotating Globe
 * ==========================================
 * Mounts into #globe-container (injected by main.py via a Bokeh Div).
 * On country click dispatches a native DOM CustomEvent:
 *
 *   document.dispatchEvent(new CustomEvent("globeCountrySelect", {
 *       detail: { iso3: "DEU", name: "Germany" }
 *   }))
 *
 * main.py's listener_div script catches this event and updates all
 * Bokeh ColumnDataSources — no iframe, no postMessage needed.
 *
 * Dependencies (loaded in templates/index.html before this file):
 *   d3 v7, topojson v3
 */

(function () {
    "use strict";

    // ─────────────────────────────────────────────
    // ISO numeric (TopoJSON feature id) → alpha-3
    // Extend when adding countries to CITY_DATA.
    // ─────────────────────────────────────────────
    const ISO_NUM_TO_A3 = {
        "4": "AFG", "8": "ALB", "12": "DZA", "24": "AGO", "32": "ARG", "36": "AUS",
        "40": "AUT", "50": "BGD", "56": "BEL", "76": "BRA", "100": "BGR", "116": "KHM",
        "124": "CAN", "144": "LKA", "152": "CHL", "156": "CHN", "170": "COL", "188": "CRI",
        "191": "HRV", "203": "CZE", "208": "DNK", "218": "ECU", "818": "EGY", "231": "ETH",
        "246": "FIN", "250": "FRA", "276": "DEU", "288": "GHA", "300": "GRC", "320": "GTM",
        "332": "HTI", "340": "HND", "348": "HUN", "356": "IND", "360": "IDN", "364": "IRN",
        "368": "IRQ", "372": "IRL", "376": "ISR", "380": "ITA", "392": "JPN", "398": "KAZ",
        "400": "JOR", "404": "KEN", "408": "PRK", "410": "KOR", "414": "KWT", "418": "LAO",
        "422": "LBN", "434": "LBY", "440": "LTU", "442": "LUX", "484": "MEX", "504": "MAR",
        "508": "MOZ", "516": "NAM", "524": "NPL", "528": "NLD", "554": "NZL", "566": "NGA",
        "578": "NOR", "586": "PAK", "591": "PAN", "604": "PER", "608": "PHL", "616": "POL",
        "620": "PRT", "634": "QAT", "642": "ROU", "643": "RUS", "682": "SAU", "694": "SLE",
        "702": "SGP", "703": "SVK", "705": "SVN", "706": "SOM", "710": "ZAF", "716": "ZWE",
        "724": "ESP", "729": "SDN", "752": "SWE", "756": "CHE", "760": "SYR", "762": "TJK",
        "764": "THA", "768": "TGO", "780": "TTO", "784": "ARE", "788": "TUN", "792": "TUR",
        "800": "UGA", "804": "UKR", "826": "GBR", "840": "USA", "858": "URY", "860": "UZB",
        "862": "VEN", "704": "VNM", "887": "YEM", "894": "ZMB",
    };

    // ─────────────────────────────────────────────
    // THEME
    // ─────────────────────────────────────────────
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    const C = {
        ocean: isDark ? "#0d1f2d" : "#ddeef7",
        land: isDark ? "#2a3830" : "#d4e8da",
        landHover: isDark ? "#2d6e52" : "#5DCAA5",
        landSelect: isDark ? "#1a5c42" : "#1D9E75",
        border: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)",
        graticule: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    };

    // ─────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────
    let selectedId = null;
    let rotation = [0, -20];
    let dragStart = null;
    let spinning = true;
    let spinTimer = null;

    // ─────────────────────────────────────────────
    // INIT
    // Two-stage boot:
    //   1. Poll until #globe-container exists in the DOM
    //   2. Use ResizeObserver to wait until it has nonzero
    //      dimensions (Bokeh sizes its Div roots asynchronously
    //      so clientWidth is 0 immediately after insertion)
    // ─────────────────────────────────────────────
    function waitForContainer(callback, attempts) {
        const el = document.getElementById("globe-container");
        if (!el) {
            if ((attempts || 0) > 50) {
                console.warn("globe.js: #globe-container not found after 50 attempts");
                return;
            }
            setTimeout(() => waitForContainer(callback, (attempts || 0) + 1), 100);
            return;
        }
        // Container exists — now wait for nonzero size
        if (el.clientWidth > 0 && el.clientHeight > 0) {
            callback(el);
            return;
        }
        const ro = new ResizeObserver((entries, observer) => {
            const { width, height } = entries[0].contentRect;
            if (width > 0 && height > 0) {
                observer.disconnect();
                callback(el);
            }
        });
        ro.observe(el);
    }

    function init(container) {
        const W = container.clientWidth;
        const H = container.clientHeight;
        const cx = W / 2;
        const cy = H / 2;
        const radius = Math.min(W, H) * 0.44;

        // ── Overlay labels (defined in index.html CSS) ──
        const label = document.createElement("div");
        label.id = "globe-label";
        label.textContent = "Globe — select country";
        container.appendChild(label);

        const subtitle = document.createElement("div");
        subtitle.id = "globe-subtitle";
        subtitle.textContent = "drag to rotate · click to select";
        container.appendChild(subtitle);

        const tooltip = document.createElement("div");
        tooltip.id = "globe-tooltip";
        container.appendChild(tooltip);

        // ── Projection ──────────────────────────────────
        const proj = d3.geoOrthographic()
            .scale(radius)
            .translate([cx, cy])
            .clipAngle(90)
            .rotate(rotation);

        const pg = d3.geoPath(proj);

        // ── SVG ─────────────────────────────────────────
        const svg = d3.select(container)
            .append("svg")
            .attr("width", W)
            .attr("height", H)
            .style("display", "block")
            .style("cursor", "grab");

        // Ocean background
        svg.append("circle")
            .attr("cx", cx).attr("cy", cy).attr("r", radius)
            .attr("fill", C.ocean);

        const rootG = svg.append("g");

        // Graticule
        const gratPath = rootG.append("path")
            .datum(d3.geoGraticule()())
            .attr("fill", "none")
            .attr("stroke", C.graticule)
            .attr("stroke-width", 0.5);

        // Countries
        const countriesG = rootG.append("g");

        // Sphere outline (on top)
        const sphereOutline = svg.append("path")
            .datum({ type: "Sphere" })
            .attr("fill", "none")
            .attr("stroke", C.border)
            .attr("stroke-width", 0.8);

        // ── Redraw helper ────────────────────────────────
        function redraw() {
            gratPath.attr("d", pg);
            countriesG.selectAll("path").attr("d", pg);
            sphereOutline.attr("d", pg);
        }

        // ── Load world topology ──────────────────────────
        d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
            .then(world => {
                const features = topojson
                    .feature(world, world.objects.countries)
                    .features;

                countriesG.selectAll("path")
                    .data(features)
                    .join("path")
                    .attr("d", pg)
                    .attr("fill", d => d.id === selectedId ? C.landSelect : C.land)
                    .attr("stroke", C.border)
                    .attr("stroke-width", 0.4)
                    .style("cursor", "pointer")

                    .on("mouseover", function (event, d) {
                        spinning = false;
                        if (d.id !== selectedId)
                            d3.select(this).attr("fill", C.landHover);
                        tooltip.style.opacity = "1";
                        tooltip.textContent = d.properties?.name || String(d.id);
                    })
                    .on("mousemove", function (event) {
                        const rect = container.getBoundingClientRect();
                        tooltip.style.left = (event.clientX - rect.left + 14) + "px";
                        tooltip.style.top = (event.clientY - rect.top - 30) + "px";
                    })
                    .on("mouseout", function (event, d) {
                        d3.select(this).attr("fill",
                            d.id === selectedId ? C.landSelect : C.land
                        );
                        tooltip.style.opacity = "0";
                    })

                    .on("click", function (event, d) {
                        event.stopPropagation();
                        spinning = false;
                        if (spinTimer) { spinTimer.stop(); spinTimer = null; }

                        // Toggle selection
                        selectedId = (d.id === selectedId) ? null : d.id;

                        countriesG.selectAll("path")
                            .attr("fill", f => f.id === selectedId ? C.landSelect : C.land);

                        const name = d.properties?.name || String(d.id);
                        subtitle.textContent = selectedId
                            ? name
                            : "drag to rotate · click to select";

                        const iso3 = selectedId
                            ? (ISO_NUM_TO_A3[String(+d.id)] || null)
                            : null;

                        // ── Notify Bokeh charts ──────────────────────────
                        // Caught by listener_div script in main.py which
                        // updates all ColumnDataSources.
                        document.dispatchEvent(new CustomEvent(
                            "globeCountrySelect",
                            { detail: { iso3, name } }
                        ));
                    });

                redraw();

                // Auto-spin on load — stops on first interaction
                spinTimer = d3.timer(() => {
                    if (!spinning) { spinTimer.stop(); spinTimer = null; return; }
                    rotation[0] += 0.15;
                    proj.rotate(rotation);
                    redraw();
                });
            })
            .catch(err => console.error("globe.js: failed to load topology", err));

        // ── Drag to rotate ───────────────────────────────
        svg.call(
            d3.drag()
                .on("start", event => {
                    spinning = false;
                    dragStart = [event.x, event.y];
                    svg.style("cursor", "grabbing");
                })
                .on("drag", event => {
                    if (!dragStart) return;
                    const dx = event.x - dragStart[0];
                    const dy = event.y - dragStart[1];
                    rotation[0] += dx * 0.4;
                    rotation[1] = Math.max(-90, Math.min(90, rotation[1] - dy * 0.4));
                    proj.rotate(rotation);
                    redraw();
                    dragStart = [event.x, event.y];
                })
                .on("end", () => {
                    dragStart = null;
                    svg.style("cursor", "grab");
                })
        );
    }

    // Boot
    waitForContainer(init);

})();
