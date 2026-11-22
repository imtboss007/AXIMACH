import test from "node:test";
import assert from "node:assert/strict";
import { getIntegrationCatalog } from "./catalog.mjs";

test("catalog covers the supplied tool families and never returns environment values", () => {
  const secret = "must-never-be-returned";
  const result = getIntegrationCatalog({
    AXIMACH_SEARXNG_URL: "https://search.example.test",
    AXIMACH_CRAWL4AI_URL: "",
    APOLLO_API_KEY: secret,
    SUPABASE_SERVICE_ROLE_KEY: secret
  });
  assert.equal(result.total, result.items.length);
  assert.ok(result.total >= 90);
  for (const name of [
    "Unslop", "LangGraph", "Apache ECharts", "TanStack Table", "Supabase",
    "Temporal", "Crawl4AI", "Scrapy", "Pelias", "OpenBB", "OpenSanctions",
    "AFFiNE", "Scout (varun-io-eng/Scout)"
  ]) assert.ok(result.items.some(item => item.name === name), "missing " + name);
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("connector readiness means configuration is present, not that the provider is healthy", () => {
  const result = getIntegrationCatalog({ AXIMACH_SEARXNG_URL: "https://search.example.test" });
  const search = result.items.find(item => item.id === "searxng");
  const crawl = result.items.find(item => item.id === "crawl4ai");
  assert.equal(search.status, "configured-unverified");
  assert.equal(search.configured, true);
  assert.equal(crawl.status, "not-configured");
  assert.equal(crawl.configured, false);
});
