import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const model = read("src/themeStudio.ts");
const studio = read("src/ThemeStudio.tsx");
const app = read("src/App.tsx");
const css = read("src/aximach-theme-studio.css");
const chart = read("src/ProductionStatusChart.tsx");
const graph = read("src/ManufacturingEcosystemGraph.tsx");

test("Theme Studio provides all ten coordinated AXIMACH presets and four appearance modes", () => {
  for (const preset of ["titanium-graphite","obsidian","midnight-navy","carbon-emerald","industrial-slate","arctic-light","platinum-light","precision-orange","steel-blue","custom"]) {
    assert.ok(model.includes('id: "' + preset + '"'), "Missing theme preset: " + preset);
  }
  for (const mode of ['id:"dark"','id:"light"','id:"system"','id:"custom"']) assert.ok(studio.includes(mode));
  assert.ok(model.includes('window.localStorage.getItem("aximach.theme-studio.v1")'));
  assert.ok(model.includes('window.localStorage.setItem("aximach.theme-studio.v1"'));
});

test("Theme Studio previews without saving, supports HEX and colour picker controls, and applies or cancels", () => {
  assert.ok(studio.includes('type="color"'));
  assert.ok(studio.includes('type="text"'));
  assert.ok(studio.includes('pattern="^#[0-9A-Fa-f]{6}$"'));
  assert.ok(studio.includes("Cancel preview"));
  assert.ok(studio.includes("Apply theme"));
  assert.ok(app.includes("const cancelThemePreview"));
  assert.ok(app.includes("const applyTheme"));
  assert.ok(app.includes("setThemeDraft"));
});

test("Global appearance maps application, chart and graph tokens onto the existing app", () => {
  for (const token of ["--ax-theme-background","--ax-theme-surface","--ax-theme-navigation","--ax-theme-sidebar","--ax-theme-chart-1","--ax-theme-graph-1"]) {
    assert.ok(model.includes(token), "Theme token missing: " + token);
    if(token.startsWith("--ax-theme-chart-")||token.startsWith("--ax-theme-graph-")) assert.ok(app.includes("Object.entries(resolvedTheme.cssVariables)"));
    else assert.ok(css.includes(token), "Global token not applied: " + token);
  }
  assert.ok(css.includes(".app-shell[data-theme] .command-rail"));
  assert.ok(css.includes(".app-shell[data-theme] .ax-full3d-label"));
  assert.ok(css.includes(".app-shell[data-theme] .react-flow__controls"));
  assert.ok(app.includes('window.dispatchEvent(new Event("aximach-theme-updated"))'));
});

test("ECharts and Manufacturing Universe use theme-aware saved visual palettes", () => {
  assert.ok(chart.includes("readChartTheme"));
  assert.ok(chart.includes('"--ax-theme-chart-"'));
  assert.ok(chart.includes('"aximach-theme-updated"'));
  assert.ok(graph.includes("var(--ax-theme-graph-1"));
  assert.ok(graph.includes("var(--ax-theme-graph-7"));
  assert.ok(read("src/ProcessScene3D.tsx").includes('window.addEventListener("aximach-theme-updated",refreshTheme)'));
  assert.ok(read("src/ProcessScene3D.tsx").includes("themePrimary"));
});
