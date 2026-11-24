import test from "node:test";
import assert from "node:assert/strict";
import {
  clearPublicApiCacheForTests,
  getPublicApiData,
  getPublicApiDirectory
} from "./public-apis.mjs";

const jsonResponse = (value, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => value
});

test("curated public API directory records source provenance and separates active adapters from review-only providers", () => {
  const directory = getPublicApiDirectory();
  assert.equal(directory.source.repository, "public-apis/public-apis");
  assert.equal(directory.source.license, "MIT");
  assert.ok(directory.items.length >= 8);
  for (const id of ["frankfurter", "nager-date", "india-ev-charging", "nasa-power", "gstinapi", "vibe-manufacturing", "nhtsa-vpic"]) {
    assert.ok(directory.items.some(item => item.id === id), "missing public API entry " + id);
  }
  assert.equal(directory.items.find(item => item.id === "gstinapi").stage, "candidate");
  assert.equal(directory.items.find(item => item.id === "vibe-manufacturing").stage, "review-required");
  assert.match(directory.items.find(item => item.id === "india-ev-charging").limitation, /26 October 2025/);
  assert.match(directory.items.find(item => item.id === "frankfurter").limitation, /not live market quotes/i);
});

test("Frankfurter v2 validates currencies, calls the fixed provider and caches reference rates", async () => {
  clearPublicApiCacheForTests();
  let calls = 0;
  let requested = "";
  const fetchImpl = async (url, options) => {
    calls += 1;
    requested = String(url);
    assert.equal(options.headers.accept, "application/json");
    return jsonResponse([
      { date: "2026-11-23", base: "INR", quote: "USD", rate: 0.0109 },
      { date: "2026-11-23", base: "INR", quote: "EUR", rate: 0.0099 }
    ]);
  };
  const first = await getPublicApiData("fx", { base: "inr", quotes: "usd,eur" }, fetchImpl);
  const second = await getPublicApiData("fx", { base: "INR", quotes: "USD,EUR" }, fetchImpl);
  assert.equal(calls, 1);
  assert.match(requested, /^https:\/\/api\.frankfurter\.dev\/v2\/rates\?/);
  assert.match(requested, /base=INR/);
  assert.match(requested, /quotes=USD%2CEUR|quotes=USD,EUR/);
  assert.equal(first.date, "2026-11-23");
  assert.deepEqual(first.rows.map(row => row.quote), ["USD", "EUR"]);
  assert.deepEqual(second.rows, first.rows);
  await assert.rejects(() => getPublicApiData("fx", { base: "INR", quotes: "INR" }, fetchImpl), /different from the base currency/);
  await assert.rejects(() => getPublicApiData("fx", { base: "IND", quotes: "USD" }, fetchImpl), /3-letter ISO 4217/);
});

test("Nager.Date v4 returns country and subdivision-aware calendar data through a pinned host", async () => {
  clearPublicApiCacheForTests();
  let requested = "";
  const fetchImpl = async url => {
    requested = String(url);
    return jsonResponse([
      { date: "2026-08-15", name: "Independence Day", countryCode: "IN", nationalHoliday: true, subdivisionCodes: null, holidayTypes: ["Public"] },
      { date: "2026-11-01", name: "Karnataka Rajyotsava", countryCode: "IN", nationalHoliday: false, subdivisionCodes: ["IN-KA"], holidayTypes: ["Public"] }
    ]);
  };
  const result = await getPublicApiData("holidays", { country: "in", year: "2026" }, fetchImpl);
  assert.equal(requested, "https://nagerholidays.com/api/v4/Holidays/IN/2026");
  assert.equal(result.holidays.length, 2);
  assert.deepEqual(result.holidays[1].subdivisionCodes, ["IN-KA"]);
  assert.match(result.note, /factory\/customer working calendar/i);
  await assert.rejects(() => getPublicApiData("holidays", { country: "IND", year: "2026" }, fetchImpl), /2-letter ISO/);
  await assert.rejects(() => getPublicApiData("holidays", { country: "IN", year: "2050" }, fetchImpl), /between/);
});

test("India EV station proxy filters the BEE-derived dataset and preserves mandatory attribution", async () => {
  clearPublicApiCacheForTests();
  let requested = "";
  const fetchImpl = async url => {
    requested = String(url);
    return jsonResponse({
      success: true,
      data: [{
        id: "evs_1234567890", operator: "Demo Operator", ownership: "govt",
        state: "Karnataka", district: "Bengaluru Urban", city: "Bengaluru",
        address: "Sample Road, Bengaluru", latitude: 12.97, longitude: 77.59,
        location_quality: "ok", standards: ["CCS2"], currents: ["DC"],
        max_power_kw: 60, distance_km: null
      }],
      meta: {
        page: 1, limit: 20, total_found: 1, total_pages: 1,
        source: { name: "EV Public Charging Stations Data till 26th October 2025", publisher: "BEE" },
        attribution: "Data: Bureau of Energy Efficiency — republished, not an official BEE service."
      }
    });
  };
  const result = await getPublicApiData("ev-stations", { state: "Karnataka", city: "Bengaluru", page: "1", limit: "20" }, fetchImpl);
  assert.match(requested, /^https:\/\/ev-charging-stations-api\.vercel\.app\/v1\/stations\?/);
  assert.match(requested, /state=Karnataka/);
  assert.match(requested, /city=Bengaluru/);
  assert.equal(result.stations[0].maxPowerKw, 60);
  assert.match(result.meta.attribution, /Bureau of Energy Efficiency/);
  assert.match(result.note, /no live charger availability/i);
  await assert.rejects(() => getPublicApiData("ev-stations", { state: "https://evil.example", city: "Bengaluru" }, fetchImpl), /valid Indian state/);
  await assert.rejects(() => getPublicApiData("ev-stations", { state: "Karnataka", page: "0" }, fetchImpl), /Page must be/);
});

test("upstream failures are returned as bounded provider errors without leaking URLs or secrets", async () => {
  clearPublicApiCacheForTests();
  await assert.rejects(
    () => getPublicApiData("fx", { base: "INR", quotes: "USD" }, async () => jsonResponse({ error: "internal details" }, 503)),
    error => error.status === 502 && error.code === "public-api-upstream-failed" && !error.message.includes("internal details")
  );
  await assert.rejects(
    () => getPublicApiData("not-an-adapter", {}, async () => { throw new Error("must not be called"); }),
    /Unknown public API adapter/
  );
});
