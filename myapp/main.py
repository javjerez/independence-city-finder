"""
City Quality of Life Dashboard — Bokeh App
===========================================
Run:
    bokeh serve myapp/ --show

Structure:
    myapp/
    ├── main.py               ← this file
    ├── templates/
    │   └── index.html        ← Jinja2 template: loads D3, globe.js, lays out page
    └── static/
        └── globe.js          ← D3 globe, dispatches CustomEvent on country click

Linked views:
    globe.js  →  CustomEvent("globeCountrySelect")
              →  listener_div script (below)
              →  updates main_source, bar_source, radar_src_a, radar_src_b
              →  all Bokeh charts re-render reactively
"""

import numpy as np
import pandas as pd
from math import pi, cos, sin

from bokeh.plotting import figure, curdoc
from bokeh.models import (
    ColumnDataSource, Div, HoverTool,
    Patches, Segment, Text,
)
from bokeh.layouts import column, row


# ─────────────────────────────────────────────
# DATA
# Replace / extend with your real dataset.
# Keys used: city, country, iso (alpha-3),
#            qol, cost, safety, health, pp, climate, pollution
# ─────────────────────────────────────────────
CITIES = pd.DataFrame([
    dict(city="Amsterdam",    country="Netherlands",   iso="NLD", qol=182, cost=78,  safety=73, health=79, pp=132, climate=82, pollution=22),
    dict(city="Vienna",       country="Austria",        iso="AUT", qol=193, cost=72,  safety=81, health=82, pp=118, climate=78, pollution=18),
    dict(city="Zurich",       country="Switzerland",    iso="CHE", qol=188, cost=98,  safety=84, health=86, pp=142, climate=76, pollution=16),
    dict(city="Copenhagen",   country="Denmark",        iso="DNK", qol=186, cost=91,  safety=83, health=85, pp=138, climate=74, pollution=14),
    dict(city="Helsinki",     country="Finland",        iso="FIN", qol=184, cost=77,  safety=86, health=83, pp=122, climate=60, pollution=12),
    dict(city="Oslo",         country="Norway",         iso="NOR", qol=181, cost=102, safety=82, health=81, pp=136, climate=62, pollution=15),
    dict(city="Stockholm",    country="Sweden",         iso="SWE", qol=185, cost=82,  safety=79, health=80, pp=128, climate=64, pollution=16),
    dict(city="Munich",       country="Germany",        iso="DEU", qol=179, cost=80,  safety=75, health=78, pp=124, climate=72, pollution=20),
    dict(city="Berlin",       country="Germany",        iso="DEU", qol=168, cost=68,  safety=68, health=74, pp=112, climate=70, pollution=24),
    dict(city="Paris",        country="France",         iso="FRA", qol=154, cost=88,  safety=55, health=76, pp=108, climate=79, pollution=34),
    dict(city="London",       country="United Kingdom", iso="GBR", qol=160, cost=92,  safety=62, health=74, pp=116, climate=72, pollution=28),
    dict(city="Barcelona",    country="Spain",          iso="ESP", qol=164, cost=64,  safety=59, health=76, pp=102, climate=92, pollution=26),
    dict(city="Madrid",       country="Spain",          iso="ESP", qol=158, cost=62,  safety=58, health=74, pp=100, climate=88, pollution=28),
    dict(city="Lisbon",       country="Portugal",       iso="PRT", qol=162, cost=56,  safety=72, health=72, pp=94,  climate=90, pollution=18),
    dict(city="Rome",         country="Italy",          iso="ITA", qol=148, cost=68,  safety=54, health=70, pp=90,  climate=88, pollution=38),
    dict(city="Milan",        country="Italy",          iso="ITA", qol=152, cost=76,  safety=56, health=72, pp=96,  climate=82, pollution=36),
    dict(city="Prague",       country="Czechia",        iso="CZE", qol=174, cost=54,  safety=74, health=72, pp=98,  climate=74, pollution=26),
    dict(city="Warsaw",       country="Poland",         iso="POL", qol=170, cost=50,  safety=70, health=70, pp=94,  climate=70, pollution=30),
    dict(city="Singapore",    country="Singapore",      iso="SGP", qol=168, cost=88,  safety=86, health=80, pp=134, climate=78, pollution=22),
    dict(city="Tokyo",        country="Japan",          iso="JPN", qol=172, cost=74,  safety=88, health=82, pp=110, climate=76, pollution=28),
    dict(city="Seoul",        country="South Korea",    iso="KOR", qol=165, cost=70,  safety=78, health=78, pp=106, climate=70, pollution=40),
    dict(city="Sydney",       country="Australia",      iso="AUS", qol=174, cost=86,  safety=72, health=80, pp=126, climate=88, pollution=18),
    dict(city="Melbourne",    country="Australia",      iso="AUS", qol=176, cost=82,  safety=74, health=81, pp=122, climate=86, pollution=16),
    dict(city="Toronto",      country="Canada",         iso="CAN", qol=168, cost=80,  safety=66, health=78, pp=118, climate=66, pollution=22),
    dict(city="Vancouver",    country="Canada",         iso="CAN", qol=172, cost=84,  safety=68, health=80, pp=124, climate=72, pollution=18),
    dict(city="New York",     country="United States",  iso="USA", qol=158, cost=100, safety=48, health=72, pp=130, climate=74, pollution=32),
    dict(city="San Francisco",country="United States",  iso="USA", qol=162, cost=108, safety=44, health=74, pp=138, climate=80, pollution=24),
    dict(city="Dubai",        country="UAE",            iso="ARE", qol=164, cost=78,  safety=84, health=74, pp=128, climate=72, pollution=36),
])


# ─────────────────────────────────────────────
# RADAR HELPERS
# ─────────────────────────────────────────────
RADAR_DIMS = [
    ("QoL",        "qol",       220),
    ("Safety",     "safety",    100),
    ("Healthcare", "health",    100),
    ("Purch.Pow",  "pp",        160),
    ("Climate",    "climate",   100),
    ("Clean Air",  "pollution",  60),   # inverted: lower pollution → higher score
]
N_DIMS = len(RADAR_DIMS)


def radar_angles():
    return [i * 2 * pi / N_DIMS - pi / 2 for i in range(N_DIMS)]


def city_to_radar_xy(city_row):
    """Convert city metrics to (xs, ys) polygon for Bokeh Patches glyph."""
    angles = radar_angles()
    xs, ys = [], []
    for (label, key, max_val), angle in zip(RADAR_DIMS, angles):
        val = city_row[key]
        if key == "pollution":
            val = max(0, max_val - val)
        norm = min(1.0, val / max_val)
        xs.append(norm * cos(angle))
        ys.append(norm * sin(angle))
    xs.append(xs[0])
    ys.append(ys[0])
    return xs, ys


def build_radar_grid_source(n_rings=4):
    all_xs, all_ys = [], []
    angles = radar_angles()
    for ring in range(1, n_rings + 1):
        r = ring / n_rings
        xs = [r * cos(a) for a in angles] + [r * cos(angles[0])]
        ys = [r * sin(a) for a in angles] + [r * sin(angles[0])]
        all_xs.append(xs)
        all_ys.append(ys)
    return ColumnDataSource(dict(xs=all_xs, ys=all_ys))


def build_radar_spoke_source():
    angles = radar_angles()
    return ColumnDataSource(dict(
        x0=[0] * N_DIMS, y0=[0] * N_DIMS,
        x1=[cos(a) for a in angles],
        y1=[sin(a) for a in angles],
    ))


def build_radar_label_source():
    angles = radar_angles()
    r_label = 1.18
    return ColumnDataSource(dict(
        x=[r_label * cos(a) for a in angles],
        y=[r_label * sin(a) for a in angles],
        label=[d[0] for d in RADAR_DIMS],
    ))


# ─────────────────────────────────────────────
# SHARED COLUMN DATA SOURCES
# All charts read from these. Selections on any
# chart propagate to all others automatically.
# ─────────────────────────────────────────────
top14 = CITIES.nlargest(14, "qol").reset_index(drop=True)

main_source = ColumnDataSource(dict(
    city       = CITIES["city"].tolist(),
    country    = CITIES["country"].tolist(),
    iso        = CITIES["iso"].tolist(),
    qol        = CITIES["qol"].tolist(),
    cost       = CITIES["cost"].tolist(),
    safety     = CITIES["safety"].tolist(),
    health     = CITIES["health"].tolist(),
    pp         = CITIES["pp"].tolist(),
    climate    = CITIES["climate"].tolist(),
    pollution  = CITIES["pollution"].tolist(),
    alpha      = [0.5]      * len(CITIES),
    size       = [8]        * len(CITIES),
    color      = ["#5DCAA5"] * len(CITIES),
))
main_source.name = "main_source"

bar_source = ColumnDataSource(dict(
    city  = top14["city"].tolist(),
    qol   = top14["qol"].tolist(),
    iso   = top14["iso"].tolist(),
    color = ["#5DCAA5"] * len(top14),
))
bar_source.name = "bar_source"

city_a = CITIES.iloc[0]
city_b = CITIES.iloc[1]
xs_a, ys_a = city_to_radar_xy(city_a)
xs_b, ys_b = city_to_radar_xy(city_b)

radar_src_a = ColumnDataSource(dict(xs=[xs_a], ys=[ys_a], name=[city_a["city"]]))
radar_src_b = ColumnDataSource(dict(xs=[xs_b], ys=[ys_b], name=[city_b["city"]]))
radar_src_a.name = "radar_src_a"
radar_src_b.name = "radar_src_b"


# ─────────────────────────────────────────────
# PANEL 1 — GLOBE PLACEHOLDER DIV
# globe.js mounts the D3 SVG into #globe-container.
# No iframe needed — globe.js is loaded as a
# normal <script> in templates/index.html.
# ─────────────────────────────────────────────
globe_div = Div(
    text='<div id="globe-container"></div>',
    width=380, height=320,
    styles={"padding": "0", "overflow": "hidden", "border-radius": "10px"},
)


# ─────────────────────────────────────────────
# PANEL 2 — RADAR / PENTAGON CHART
# ─────────────────────────────────────────────
def make_radar_panel():
    p = figure(
        width=380, height=320,
        x_range=(-1.35, 1.35), y_range=(-1.35, 1.35),
        toolbar_location=None,
        title="City comparison",
    )
    p.axis.visible = False
    p.grid.visible = False
    p.outline_line_color = None
    p.title.text_font_size = "11px"
    p.title.text_color = "#888780"
    p.background_fill_color = None
    p.border_fill_color = None

    p.patches("xs", "ys", source=build_radar_grid_source(),
              fill_color=None, line_color="#e0e0e0", line_width=0.5)
    p.segment("x0", "y0", "x1", "y1", source=build_radar_spoke_source(),
              line_color="#e0e0e0", line_width=0.5)
    p.text("x", "y", "label", source=build_radar_label_source(),
           text_font_size="9px", text_align="center",
           text_baseline="middle", text_color="#888780")

    p.patches("xs", "ys", source=radar_src_a,
              fill_color="#1D9E75", fill_alpha=0.18,
              line_color="#1D9E75", line_width=1.5)
    p.patches("xs", "ys", source=radar_src_b,
              fill_color="#7F77DD", fill_alpha=0.18,
              line_color="#7F77DD", line_width=1.5)

    return p


# ─────────────────────────────────────────────
# PANEL 3 — BAR CHART
# ─────────────────────────────────────────────
def make_bar_panel():
    p = figure(
        x_range=top14["city"].tolist(),
        width=380, height=270,
        toolbar_location=None,
        title="Quality of life index (top 14 cities)",
    )
    p.title.text_font_size = "11px"
    p.title.text_color = "#888780"
    p.background_fill_color = None
    p.border_fill_color = None
    p.grid.grid_line_color = "rgba(0,0,0,0.05)"
    p.xgrid.grid_line_color = None
    p.y_range.start = 100
    p.axis.axis_label_text_font_size = "9px"
    p.axis.major_label_text_font_size = "8px"
    p.axis.major_label_text_color = "#888780"
    p.xaxis.major_label_orientation = 0.7

    p.vbar(x="city", top="qol", width=0.7, source=bar_source,
           fill_color="color", fill_alpha=0.75, line_color=None)

    p.add_tools(HoverTool(tooltips=[
        ("City",    "@city"),
        ("Country", "@iso"),
        ("QoL",     "@qol"),
    ]))
    return p


# ─────────────────────────────────────────────
# PANEL 4 — SCATTER PLOT
# ─────────────────────────────────────────────
def make_scatter_panel():
    p = figure(
        width=380, height=270,
        x_range=(44, 115), y_range=(140, 200),
        toolbar_location="right",
        title="Cost of living vs. QoL",
        tools="pan,wheel_zoom,box_select,tap,reset",
    )
    p.title.text_font_size = "11px"
    p.title.text_color = "#888780"
    p.background_fill_color = None
    p.border_fill_color = None
    p.grid.grid_line_color = "rgba(0,0,0,0.05)"
    p.xaxis.axis_label = "cost of living index"
    p.yaxis.axis_label = "quality of life index"
    p.axis.axis_label_text_font_size = "9px"
    p.axis.major_label_text_font_size = "8px"
    p.axis.major_label_text_color = "#888780"

    p.circle(
        x="cost", y="qol", source=main_source,
        size="size", color="color", alpha="alpha",
        line_color="white", line_width=0.8,
        selection_color="#1D9E75",
        nonselection_alpha=0.3, nonselection_color="#534AB7",
    )
    p.add_tools(HoverTool(tooltips=[
        ("City",    "@city"),
        ("Country", "@country"),
        ("QoL",     "@qol"),
        ("Cost",    "@cost"),
        ("Safety",  "@safety"),
    ]))
    return p


# ─────────────────────────────────────────────
# CROSS-CHART LINKED SELECTION CALLBACK
#
# This <script> tag is injected into the page as
# a hidden Div. It listens for the CustomEvent
# dispatched by globe.js and updates all Bokeh
# ColumnDataSources, which triggers re-renders.
#
# City data and radar dims are embedded as JSON so
# no Python round-trip is needed on each interaction.
# ─────────────────────────────────────────────
import json

_city_data_json = json.dumps([
    {k: row[k] for k in ["city","country","iso","qol","cost",
                          "safety","health","pp","climate","pollution"]}
    for _, row in CITIES.iterrows()
])

_radar_dims_json = json.dumps([
    {"label": d[0], "key": d[1], "max": d[2], "invert": d[1] == "pollution"}
    for d in RADAR_DIMS
])

listener_div = Div(text=f"""
<script>
(function () {{

    const CITY_DATA  = {_city_data_json};
    const RADAR_DIMS = {_radar_dims_json};
    const N          = RADAR_DIMS.length;

    function getSource(name) {{
        // Bokeh stores all models in the first document on the page
        return Bokeh.documents[0].get_model_by_name(name);
    }}

    function cityToXY(city) {{
        const angles = Array.from({{length: N}},
            (_, i) => i * 2 * Math.PI / N - Math.PI / 2);
        const xs = [], ys = [];
        RADAR_DIMS.forEach((dim, i) => {{
            let v = city[dim.key] ?? 0;
            if (dim.invert) v = Math.max(0, dim.max - v);
            const norm = Math.min(1, v / dim.max);
            xs.push(norm * Math.cos(angles[i]));
            ys.push(norm * Math.sin(angles[i]));
        }});
        xs.push(xs[0]); ys.push(ys[0]);
        return [xs, ys];
    }}

    function onCountrySelect(evt) {{
        const iso3       = evt.detail.iso3;
        const mainSrc    = getSource("main_source");
        const barSrc     = getSource("bar_source");
        const radarSrcA  = getSource("radar_src_a");
        const radarSrcB  = getSource("radar_src_b");
        if (!mainSrc) {{ console.warn("Bokeh sources not ready yet"); return; }}

        // ── Scatter: highlight selected country ───────
        const alphas = [], sizes = [], colors = [];
        CITY_DATA.forEach(c => {{
            const match = iso3 && c.iso === iso3;
            alphas.push(match ? 1.0  : 0.25);
            sizes.push( match ? 10   : 6);
            colors.push(match ? "#1D9E75" : "#534AB7");
        }});
        mainSrc.data["alpha"] = alphas;
        mainSrc.data["size"]  = sizes;
        mainSrc.data["color"] = colors;
        mainSrc.change.emit();

        // ── Bar: highlight selected country ───────────
        barSrc.data["color"] = barSrc.data["iso"].map(
            iso => (iso3 && iso === iso3) ? "#1D9E75" : "#5DCAA5"
        );
        barSrc.change.emit();

        // ── Radar: update city A and city B polygons ──
        const matches = CITY_DATA.filter(c => c.iso === iso3);
        const cityA   = matches[0] || CITY_DATA[0];
        const cityB   = matches[1] || CITY_DATA.find(c => c.iso !== iso3) || CITY_DATA[1];

        const [xsA, ysA] = cityToXY(cityA);
        const [xsB, ysB] = cityToXY(cityB);

        radarSrcA.data = {{ xs: [xsA], ys: [ysA], name: [cityA.city] }};
        radarSrcB.data = {{ xs: [xsB], ys: [ysB], name: [cityB.city] }};
        radarSrcA.change.emit();
        radarSrcB.change.emit();
    }}

    // globe.js dispatches this event on document click
    document.addEventListener("globeCountrySelect", onCountrySelect);

}})();
</script>
""", width=0, height=0, visible=False)


# ─────────────────────────────────────────────
# ASSEMBLE LAYOUT AND REGISTER WITH BOKEH
# ─────────────────────────────────────────────
radar_fig   = make_radar_panel()
bar_fig     = make_bar_panel()
scatter_fig = make_scatter_panel()

layout = column(
    row(globe_div,  radar_fig),
    row(bar_fig,    scatter_fig),
    listener_div,
    sizing_mode="fixed",
)

curdoc().add_root(layout)
curdoc().title = "City QoL Dashboard"
