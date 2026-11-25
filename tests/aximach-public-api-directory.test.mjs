import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Public API tools are presented in the existing admin Integrations workspace",()=>{
  const app=source("src/App.tsx");
  const workspace=source("src/IntegrationHubWorkspace.tsx");
  assert.ok(app.includes('const IntegrationHubWorkspace = lazy(() => import("./IntegrationHubWorkspace"))'));
  assert.ok(app.includes('activeModuleId === "integrations"'));
  assert.ok(workspace.includes("function requestPublicApi<T>"));
  assert.ok(workspace.includes("getServerAuthHeaders"));
  assert.ok(workspace.includes("const connection=readConnection();"));
  assert.ok(workspace.includes("Public API tools"));
  assert.ok(workspace.includes("Additional APIs screened"));
  assert.ok(workspace.includes("setPublicApis(parsed.data.publicApis||null)"));
});

test("Live public API UI exposes FX, holiday and India EV read-only tools with explicit limitations",()=>{
  const workspace=source("src/IntegrationHubWorkspace.tsx");
  for(const text of [
    "/api/public-apis/fx?",
    "/api/public-apis/holidays?",
    "/api/public-apis/ev-stations?",
    "Supplier currency reference",
    "Factory working-day reference",
    "India EV charging directory",
    "read-only",
    "never write manufacturing, costing or schedule records",
    "Attribution:",
    "Map location"
  ]) assert.ok(workspace.includes(text),"missing UI contract: "+text);
  assert.ok(workspace.includes("No API key")||workspace.includes("No key required"));
  assert.ok(workspace.includes("reference rates"));
  assert.ok(workspace.includes("Additional APIs screened"));
});

test("Public API adapters use fixed upstream origins and server-side validated parameters",()=>{
  const adapter=source("server/integrations/public-apis.mjs");
  assert.ok(adapter.includes("https://api.frankfurter.dev/v2/rates?"));
  assert.ok(adapter.includes("https://nagerholidays.com/api/v4/Holidays/"));
  assert.ok(adapter.includes("https://ev-charging-stations-api.vercel.app/v1/stations?"));
  assert.ok(adapter.includes("requestJson(url"));
  assert.ok(adapter.includes("AbortSignal.timeout"));
  assert.ok(adapter.includes("clearPublicApiCacheForTests"));
  assert.ok(adapter.includes("location_quality: \"ok\""));
  assert.ok(!adapter.includes("params.url"));
  assert.ok(!adapter.includes("fetch(params.url"));
});

test("Public API proxy is limited to three GET adapters and is administrator-only with audit receipts",()=>{
  const server=source("server/index.mjs");
  assert.ok(server.includes("const publicApiRoute = url.pathname.match("));
  assert.ok(server.includes("fx|holidays|ev-stations"));
  assert.ok(server.includes('if (publicApiRoute && req.method === "GET")'));
  assert.ok(server.includes('principal.role !== "admin"'));
  assert.ok(server.includes('"authorization.denied"'));
  assert.ok(server.includes('"public-api.read"'));
  assert.ok(server.includes("await saveDb()"));
  assert.ok(server.includes("getPublicApiData(publicApiRoute[1]"));
});

test("Public API source notice separates directory MIT from provider data and usage rights",()=>{
  const notices=source("THIRD_PARTY_NOTICES.md");
  const adoption=source("docs/public-api-adoption.md");
  assert.ok(notices.includes("public-apis/public-apis"));
  assert.ok(notices.includes("does not grant a licence to provider APIs"));
  assert.ok(adoption.includes("26 October 2025"));
  assert.ok(adoption.includes("No API key"));
  assert.ok(adoption.includes("Third-party republishing"));
  assert.ok(adoption.includes("No new runtime package or provider API key was added"));
});
