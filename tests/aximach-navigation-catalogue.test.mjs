import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (path) => readFile(resolve(root, path), "utf8");

test("the main module catalogue and 3D command sphere expose the same 22 unique workspaces", async () => {
  const [app, orb] = await Promise.all([
    readSource("src/App.tsx"),
    readSource("src/AXIMACHOrb.tsx")
  ]);

  const moduleBlock = app.match(/const modules: ModuleItem\[\] = \[([\s\S]*?)\n\];/);
  const satelliteBlock = orb.match(/const satellites = \[([\s\S]*?)\n\];/);
  assert.ok(moduleBlock, "main module catalogue must exist");
  assert.ok(satelliteBlock, "3D sphere module catalogue must exist");

  const moduleIds = [...moduleBlock[1].matchAll(/\{\s*id:\s*"([^"]+)"\s*,\s*title:/g)].map((match) => match[1]);
  const satelliteIds = [...satelliteBlock[1].matchAll(/\{\s*id:\s*"([^"]+)"\s*,\s*label:/g)].map((match) => match[1]);

  assert.equal(moduleIds.length, 22, "the main catalogue must contain 22 modules");
  assert.equal(new Set(moduleIds).size, 22, "main module IDs must be unique");
  assert.equal(satelliteIds.length, 22, "the 3D sphere must expose all 22 module controls");
  assert.equal(new Set(satelliteIds).size, 22, "3D sphere module IDs must be unique");
  assert.deepEqual([...satelliteIds].sort(), [...moduleIds].sort(), "the 3D sphere and navigation rail must expose identical module IDs");
});


test("Company Directory exposes both company and factory registers", async () => {
  const source = await readSource("src/ManufacturingMasterWorkspace.tsx");
  assert.match(source, /\{moduleId === "companies" && <div className="costing-tabs">/);
  assert.match(source, /setTab\("companies"\)/);
  assert.match(source, /setTab\("factories"\)/);
  assert.doesNotMatch(source, /\{false && moduleId === "companies"/);
});


test("Data Exchange import and export workspaces forward real cross-module navigation", async () => {
  const source = await readSource("src/App.tsx");
  assert.match(source, /<ExportCentreWorkspace[^>]*onSelectModule=\{onSelectModule\}/);
  assert.match(source, /<ImportCentreWorkspace[^>]*onSelectModule=\{onSelectModule\}/);
  assert.ok(source.includes('<DataExchangeWorkspace onBack={() => selectModule("command-centre")} onNotice={setNotice} notice={notice} onSelectModule={selectModule} />'));
  assert.doesNotMatch(source, /<ExportCentreWorkspace[^>]*onSelectModule=\{\(\)\s*=>\s*\{\}\}/);
  assert.doesNotMatch(source, /<ImportCentreWorkspace[^>]*onSelectModule=\{\(\)\s*=>\s*\{\}\}/);
});


test("shared searchable dropdown menus use a responsive column layout", async () => {
  const source = await readSource("src/aximach-ui.css");
  assert.match(source, /\.ax-search-multi-options\s*\{[^}]*display:\s*grid\s*!important/s);
  assert.match(source, /\.ax-search-multi-options\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit/s);
  assert.match(source, /\.searchable-picker-menu\s*\{[^}]*display:\s*grid/s);
  assert.match(source, /\.searchable-picker-menu\s*\{[^}]*grid-template-columns:/s);
});

test("immersive workspace command header stays above the raised navigation rail", async () => {
  const source = await readSource("src/aximach-ui.css");
  assert.match(source, /\.app-shell:has\(\.route-flow-workspace\) \.command-deck,[\s\S]*?z-index:\s*60\s*!important/);
});


test("Dashboard has five separate live 3D data shells with real module navigation", async () => {
  const dashboard = await readSource("src/DashboardWorkspace.tsx");
  const orb = await readSource("src/DashboardDataOrb.tsx");
  const styles = await readSource("src/aximach-ui.css");
  for (const title of ["Recent Operations","Records","Exceptions","Master Records","Production Status"]) {
    assert.ok(dashboard.includes('title="' + title + '"'), "missing live dashboard sphere: " + title);
  }
  for (const source of ["recent.map(op=>","companies.length","pos.length","lines.length","overdue.slice","holds.slice","activeRows(data.processDefinitions)","openOps.length","completeOps.length","pendingJobs.length"]) {
    assert.ok(dashboard.includes(source), "dashboard sphere must be derived from saved data: " + source);
  }
  assert.ok(orb.includes("useReducedMotion()"));
  assert.ok(orb.includes("rotateY: 360"));
  assert.ok(orb.includes("preserve-3d"));
  assert.ok(orb.includes("onClick={() => onSelectModule(item.moduleId)}"));
  assert.ok(styles.includes(".dashboard-data-orb-grid"));
  assert.ok(styles.includes(".dashboard-data-orb-node"));
  assert.ok(styles.includes("perspective:700px"));
  assert.ok(styles.includes("backface-visibility:hidden"));
});


test("mobile dashboard preserves the six live record nodes in the rotating 3D shell", async () => {
  const orb = await readSource("src/AXIMACHOrb.tsx");
  const styles = await readSource("src/aximach-ui.css");
  assert.ok(orb.includes('className="ax-orb-lower-shell"'));
  assert.ok(orb.includes('className="ax-orb-lower-summary-grid"'));
  assert.match(styles, /@media\(max-width:620px\)[\s\S]*?\.ax-orb-lower-shell\s*\{[^}]*display:block!important/);
  assert.match(styles, /@media\(max-width:620px\)[\s\S]*?\.ax-orb-lower-summary-grid\s*\{\s*display:none!important/);
  assert.ok(orb.includes('aria-label="Separate live record summary shell"'));
});


test("Process Map interactive graph uses exact PO-line operations, scoped material records, transport legs and saved BOM links", async () => {
  const source = await readSource("src/LinkedProcessWorkspace.tsx");
  assert.ok(source.includes('id:"graph",label:"Interactive Graph"'));
  assert.ok(source.includes('visualStyle==="graph" && exportOperations.length'));
  assert.ok(source.includes("processMapMaterialEntries.forEach"));
  assert.ok(source.includes("componentMaterialProcessLinks.forEach"));
  assert.ok(source.includes("componentTransportLegs.forEach"));
  assert.ok(source.includes("if(link.poId!==poId||link.poLineId!==selectedLine?.id||link.componentId!==selectedLine?.componentId)return false;"));
  assert.ok(source.includes("poLineId === selectedLine?.id || (!leg.poLineId && selectedComponentLineCount === 1)"));
  assert.ok(source.includes("nodesDraggable={false}"));
  assert.ok(source.includes("<ProcessUniverse3D"));
});

test("Manufacturing Universe defaults to a live cross-module ecosystem graph and preserves PO route mode", async () => {
  const workspace = await readSource("src/ManufacturingUniverseWorkspace.tsx");
  const graph = await readSource("src/ManufacturingEcosystemGraph.tsx");
  const styles = await readSource("src/aximach-ui.css");
  assert.ok(workspace.includes('useState<"ecosystem"|"route">("ecosystem")'));
  assert.ok(!workspace.includes("One Component Preview"));
  assert.ok(workspace.includes('<ManufacturingEcosystemGraph data={data}'));
  assert.ok(workspace.includes('universeView==="route"'));
  for (const source of ["data.companies","data.factories","data.purchaseOrders","data.components","data.vendors","data.processDefinitions","data.operations","data.materialCostEntries","data.inspectionMeasurements","data.transportLegs","data.paymentTransactions","data.contactProfiles"]) {
    assert.ok(graph.includes(source), "ecosystem graph must read live source records: "+source);
  }
  for (const relation of ['"placed by"','"orders"','"performed by"','"supplied by"','"inspects"','"carried by"','"paid to"','"contact for"']) {
    assert.ok(graph.includes(relation), "ecosystem graph is missing saved-ID relationship: "+relation);
  }
  assert.ok(graph.includes('visibleKinds'));
  assert.ok(graph.includes('onNavigate(selected.moduleId,selected.context)'));
  assert.ok(styles.includes(".ax-ecosystem-stage"));
  assert.ok(styles.includes(".ax-ecosystem-node"));
});

test("Customer Directory includes an evidence-first Lead Discovery view", async () => {
 const workspace = await readSource("src/CustomerDirectoryWorkspace.tsx");
 const panel = await readSource("src/LeadDiscoveryPanel.tsx");
 assert.ok(workspace.includes('<LeadDiscoveryPanel companies={companies} prospects={prospects}'));
 assert.ok(workspace.includes('onConvertProspect={convertProspect}'));
 assert.ok(panel.includes('/api/lead-discovery/search'));
 assert.ok(panel.includes('provider:"SearXNG"'));
 assert.ok(panel.includes('stage:"New"'));
 assert.ok(panel.includes('target="_blank" rel="noopener noreferrer"'));
 assert.ok(panel.includes('row.stage==="Qualified"'));
});


test("hybrid touch devices activate the phone workspace shell when a precise pointer is also present", async () => {
  const [app, styles] = await Promise.all([
    readSource("src/App.tsx"),
    readSource("src/aximach-ui.css")
  ]);

  assert.ok(app.includes('window.matchMedia("(any-pointer: coarse)").matches'),
    "touch viewport detection must include secondary touch pointers, not only the primary pointer");
  assert.ok(styles.includes("(any-pointer:coarse)"),
    "responsive workspace rules must activate when any available pointer is touch-capable");
});


test("3D process labels and transport markers use only their projected left/top anchors", async () => {
  const source = await readSource("src/aximach-ui.css");
  assert.match(
    source,
    /\.ax-full3d-label-layer\s*>\s*\.ax-full3d-label[\s\S]*?right:\s*auto!important;[\s\S]*?bottom:\s*auto!important;/,
    "3D labels must clear opposing inset values so projected left/top coordinates control their position"
  );
  assert.match(
    source,
    /\.ax-full3d-label-layer\s*>\s*\.ax-full3d-transport-icon[\s\S]*?right:\s*auto!important;[\s\S]*?bottom:\s*auto!important;/,
    "3D transport markers must clear opposing inset values so projected left/top coordinates control their position"
  );
});
