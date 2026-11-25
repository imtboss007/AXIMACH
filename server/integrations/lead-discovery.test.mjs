import test from "node:test";
import assert from "node:assert/strict";
import { searchSearxng, enrichOfficialWebsite } from "./lead-discovery.mjs";
import { getRequiredPermission, hasPermission } from "../auth.mjs";

const env = { AXIMACH_SEARXNG_URL: "http://127.0.0.1:8080" };

test("SearXNG discovery requests JSON and returns at most ten public results from one instance", async () => {
  let calledUrl = "";
  const response = await searchSearxng("CNC machining OEM buyers India", {
    env,
    now: () => new Date("2026-11-22T08:00:00.000Z"),
    fetchImpl: async (url, options) => {
      calledUrl = url;
      assert.equal(options.method, "GET");
      assert.equal(options.redirect, "error");
      const parsed = new URL(url);
      assert.equal(parsed.searchParams.get("format"), "json");
      assert.equal(parsed.searchParams.get("safesearch"), "1");
      assert.equal(parsed.searchParams.get("pageno"), "1");
      return {
        ok: true,
        json: async () => ({
          results: Array.from({ length: 12 }, (_, i) => ({
            title: "Company " + i,
            url: "https://example.com/company/" + i,
            content: "Public result " + i,
            engines: ["google"]
          }))
        })
      };
    }
  });
  assert.equal(new URL(calledUrl).pathname, "/search");
  assert.equal(response.results.length, 10);
  assert.equal(response.provider, "SearXNG");
  assert.equal(response.retrievedAt, "2026-11-22T08:00:00.000Z");
  assert.equal(response.sources.length, 1);
  assert.equal(response.sources[0].status, "ok");
});

test("SearXNG fans out across configured instances and deduplicates source URLs", async () => {
  const result = await searchSearxng("industrial automation suppliers", {
    env: { AXIMACH_SEARXNG_URLS: "https://search-one.example;https://search-two.example" },
    fetchImpl: async url => {
      const isFirst = new URL(url).hostname === "search-one.example";
      return {
        ok: true,
        json: async () => ({
          results: isFirst
            ? [
                { title: "Factory A", url: "https://factory.example/about", content: "One", engines: ["engine-a"] },
                { title: "Factory B", url: "https://factory.example/contact", content: "Two", engines: ["engine-a"] }
              ]
            : [
                { title: "Factory A duplicate", url: "https://factory.example/about", content: "Duplicate", engines: ["engine-b"] },
                { title: "Factory C", url: "https://factory.example/company", content: "Three", engines: ["engine-b"] }
              ]
        })
      };
    }
  });
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources.every(source => source.status === "ok"), true);
  assert.equal(result.results.length, 3);
  assert.equal(result.results.find(row => row.url.endsWith("/about")).engine, "engine-a, engine-b");
});

test("SearXNG returns available results and reports a failed secondary source", async () => {
  const result = await searchSearxng("precision machining suppliers", {
    env: { AXIMACH_SEARXNG_URLS: "https://search-one.example;https://search-two.example" },
    fetchImpl: async url => {
      if (new URL(url).hostname === "search-two.example") throw new Error("offline");
      return { ok: true, json: async () => ({ results: [{ title: "Supplier", url: "https://supplier.example", content: "", engines: [] }] }) };
    }
  });
  assert.equal(result.partialFailure, true);
  assert.equal(result.sources[0].status, "ok");
  assert.equal(result.sources[1].status, "error");
  assert.equal(result.results.length, 1);
});

test("SearXNG fails only when no configured source succeeds", async () => {
  await assert.rejects(
    () => searchSearxng("precision machining", {
      env: { AXIMACH_SEARXNG_URLS: "https://search-one.example;https://search-two.example" },
      fetchImpl: async () => { throw new Error("offline"); }
    }),
    error => error.status === 502 && error.code === "provider-unavailable"
  );
});

test("SearXNG filters non-web, credential-bearing and local/private result URLs", async () => {
  const response = await searchSearxng("industrial automation suppliers", {
    env,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        results: [
          { title: "Private", url: "http://192.168.1.20/" },
          { title: "Loopback", url: "http://localhost/private" },
          { title: "Script", url: "javascript:alert(1)" },
          { title: "Credentials", url: "https://user:pass@example.com/" },
          { title: "Public", url: "https://public.example.org/company" }
        ]
      })
    })
  });
  assert.deepEqual(response.results.map(row => row.title), ["Public"]);
});

test("SearXNG reports missing configuration and rejects short queries", async () => {
  await assert.rejects(() => searchSearxng("CNC", { env: {} }), error => error.status === 503 && error.code === "not-configured");
  await assert.rejects(() => searchSearxng("  ", { env }), error => error.status === 400 && error.code === "invalid-query");
});

test("SearXNG explains when JSON output is disabled", async () => {
  await assert.rejects(
    () => searchSearxng("precision machining", { env, fetchImpl: async () => ({ ok: false, status: 403 }) }),
    error => error.status === 502 && error.code === "json-disabled" && error.message.includes("settings.yml")
  );
});

test("official website enrichment extracts public organization metadata without contact harvesting", async () => {
  const html = [
    "<html><head><title>Precision Works</title>",
    '<meta name="description" content="Precision machining and fabrication.">',
    '<meta property="og:site_name" content="Precision Works">',
    '<script type="application/ld+json">',
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Precision Works",
      legalName: "Precision Works Private Limited",
      url: "https://www.precision.example/",
      description: "CNC machining, turning and milling.",
      email: "do-not-return@example.com",
      telephone: "+91 9999999999",
      sameAs: ["https://www.linkedin.com/company/precision-works"]
    }),
    "</script></head><body><h1>Precision Works</h1></body></html>"
  ].join("");
  const result = await enrichOfficialWebsite("https://www.precision.example/about", {
    env: { AXIMACH_DISCOVERY_ALLOWED_HOSTS: "*.precision.example" },
    lookupImpl: async host => {
      assert.equal(host, "www.precision.example");
      return [{ address: "93.184.216.34", family: 4 }];
    },
    requestImpl: async (url, addresses) => {
      assert.equal(url.hostname, "www.precision.example");
      assert.deepEqual(addresses[0], { address: "93.184.216.34", family: 4 });
      return html;
    },
    now: () => new Date("2026-11-22T08:15:00.000Z")
  });
  assert.equal(result.provider, "Official website");
  assert.equal(result.title, "Precision Works");
  assert.equal(result.organization.legalName, "Precision Works Private Limited");
  assert.deepEqual(result.organization.sameAs, ["https://www.linkedin.com/company/precision-works"]);
  assert.equal(JSON.stringify(result).includes("9999999999"), false);
  assert.equal(JSON.stringify(result).includes("do-not-return@example.com"), false);
});

test("official website enrichment requires an administrator allowlist and public DNS addresses", async () => {
  await assert.rejects(
    () => enrichOfficialWebsite("https://unknown.example/", { env: {} }),
    error => error.status === 503 && error.code === "website-enrichment-not-configured"
  );
  await assert.rejects(
    () => enrichOfficialWebsite("https://unknown.example/", {
      env: { AXIMACH_DISCOVERY_ALLOWED_HOSTS: "approved.example" },
      lookupImpl: async () => [{ address: "10.0.0.8", family: 4 }],
      requestImpl: async () => { throw new Error("must not request a private address"); }
    }),
    error => error.status === 403 && error.code === "host-not-allowlisted"
  );
  await assert.rejects(
    () => enrichOfficialWebsite("https://www.approved.example/", {
      env: { AXIMACH_DISCOVERY_ALLOWED_HOSTS: "*.approved.example" },
      lookupImpl: async () => [{ address: "192.168.1.10", family: 4 }],
      requestImpl: async () => { throw new Error("must not request a private address"); }
    }),
    error => error.status === 403 && error.code === "non-public-website-host"
  );
});

test("official website enrichment rejects unsafe URLs and redirects", async () => {
  await assert.rejects(
    () => enrichOfficialWebsite("http://approved.example/", { env: { AXIMACH_DISCOVERY_ALLOWED_HOSTS: "approved.example" } }),
    error => error.status === 400 && error.code === "invalid-website-url"
  );
  await assert.rejects(
    () => enrichOfficialWebsite("https://approved.example/", {
      env: { AXIMACH_DISCOVERY_ALLOWED_HOSTS: "approved.example" },
      lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }],
      requestImpl: async () => { throw Object.assign(new Error("redirect"), { status: 502, code: "website-redirect-blocked" }); }
    }),
    error => error.code === "website-redirect-blocked"
  );
});

test("lead discovery endpoints are tenant-scoped read permissions", () => {
  assert.equal(getRequiredPermission("/api/lead-discovery/search", "POST"), "data:read");
  assert.equal(getRequiredPermission("/api/lead-discovery/enrich", "POST"), "data:read");
  assert.equal(hasPermission({ role: "viewer" }, "data:read"), true);
  assert.equal(hasPermission({ role: "viewer" }, "data:write"), false);
});
