const CACHE = new Map();
const DEFAULT_TIMEOUT_MS = 10_000;

export const PUBLIC_API_SOURCE = Object.freeze({
  repository: "public-apis/public-apis",
  repositoryUrl: "https://github.com/public-apis/public-apis",
  readmeUrl: "https://github.com/public-apis/public-apis/blob/master/README.md",
  license: "MIT",
  note: "A community-maintained directory, not an API gateway or uptime guarantee. Provider access, data rights, limits and service terms remain separate."
});

// Deliberately curated from the upstream directory. An entry is not treated as
// tested or production-ready solely because it appears in public-apis/README.md.
const PUBLIC_APIS = [
  {
    id: "frankfurter",
    name: "Frankfurter",
    category: "Currency Exchange",
    description: "Reference exchange rates and historical time series from central banks and official sources.",
    purpose: "Reference conversion for supplier quotations, imported material comparisons and export estimates.",
    auth: "None",
    https: "Yes",
    cors: "Yes",
    stage: "live-adapter",
    docs: "https://frankfurter.dev/",
    upstream: "https://github.com/lineofflight/frankfurter",
    coverage: "219 currencies and 39 other assets; multi-provider reference rates.",
    limitation: "Reference rates, not executable FX market quotes. Rates update according to source publication schedules; never overwrite a negotiated, bank or accounting rate."
  },
  {
    id: "nager-date",
    name: "Nager.Date",
    category: "Calendar",
    description: "Public holiday calendar with country and first-level subdivision coverage.",
    purpose: "Factory working-day planning, supplier lead-time context and production calendar review.",
    auth: "None",
    https: "Yes",
    cors: "No (upstream directory snapshot; current v4 docs advertise browser access)",
    stage: "live-adapter",
    docs: "https://nagerholidays.com/api",
    upstream: "https://github.com/nager/Nager.Date",
    coverage: "200+ countries; regional subdivision codes where supplied by the source.",
    limitation: "Calendar reference only. Verify Karnataka, company-specific shutdowns, local observances and customer working calendars before changing promised delivery dates."
  },
  {
    id: "india-ev-charging",
    name: "India EV Charging Station Directory",
    category: "Transportation",
    description: "Searchable India public charging station and connector directory.",
    purpose: "Optional EV fleet / transport feasibility lookup by state, city and charging connector.",
    auth: "None",
    https: "Yes",
    cors: "Yes",
    stage: "live-adapter",
    docs: "https://ev-charging-stations-api.vercel.app/docs",
    upstream: "https://ev-charging-stations-api.vercel.app/",
    coverage: "BEE public charging station dataset republished by a third-party API.",
    limitation: "Snapshot dated 26 October 2025; no live availability, tariffs or opening hours. Not an official BEE service. Preserve data attribution; check coordinate quality before routing."
  },
  {
    id: "nasa-power",
    name: "NASA POWER",
    category: "Environment / Energy",
    description: "Global solar and meteorological analysis-ready data services.",
    purpose: "Optional factory-site solar resource and historical climate context.",
    auth: "None",
    https: "Yes",
    cors: "Yes",
    stage: "candidate",
    docs: "https://power.larc.nasa.gov/docs/services/api/",
    upstream: "https://github.com/NASA",
    coverage: "Global gridded solar and meteorological datasets with multiple temporal resolutions.",
    limitation: "Historical/modelled resource data, not a live plant meter or short-term operational forecast. Confirm variable, temporal resolution and units before engineering decisions."
  },
  {
    id: "gstinapi",
    name: "gstinapi.in",
    category: "Business / India compliance",
    description: "Third-party GSTIN lookup, vendor monitoring and GST workflow APIs.",
    purpose: "Optional supplier master due-diligence support after an administrator configures a private API key.",
    auth: "apiKey",
    https: "Yes",
    cors: "No",
    stage: "candidate",
    docs: "https://www.gstinapi.in/docs",
    upstream: "https://www.gstinapi.in/",
    coverage: "India GSTIN / PAN lookup and related paid workflow endpoints.",
    limitation: "Private service, not a government or GSTN website. New accounts advertise up to 75 free credits; successful lookups consume credits and paid credits may follow. No credential is configured or called by AXIMACH."
  },
  {
    id: "vibe-manufacturing",
    name: "Vibe Manufacturing",
    category: "Business / Manufacturing",
    description: "Manufacturer directory and supplier matching service listed by the upstream directory.",
    purpose: "Potential manufacturer discovery and supplier research.",
    auth: "None (as listed)",
    https: "Yes",
    cors: "Yes",
    stage: "review-required",
    docs: "https://vibe-manufacturing.com/agents",
    upstream: "https://vibe-manufacturing.com/agents",
    coverage: "Provider-described manufacturer directory and sourcing assistance.",
    limitation: "Provider identity, endpoint contract, data provenance, usage terms and reliability require a separate review. Not called by AXIMACH."
  },
  {
    id: "nhtsa-vpic",
    name: "NHTSA vPIC",
    category: "Vehicle / Automotive",
    description: "Official US vehicle product information and vehicle make / model lookup API.",
    purpose: "Optional automotive reference for US vehicle makes, models and manufacturer records.",
    auth: "None",
    https: "Yes",
    cors: "Unknown",
    stage: "candidate",
    docs: "https://vpic.nhtsa.dot.gov/api/",
    upstream: "https://www.nhtsa.gov/",
    coverage: "United States vehicle product information catalogue.",
    limitation: "US-specific reference data; not a global vehicle fitment, homologation, engineering drawing or part-compatibility approval."
  },
  {
    id: "patentsview",
    name: "PatentsView",
    category: "Patent / Engineering intelligence",
    description: "US patent grant data for exploring and visualising innovation trends.",
    purpose: "Optional prior-art and competitor technology research.",
    auth: "None (as listed)",
    https: "Yes",
    cors: "Unknown",
    stage: "candidate",
    docs: "https://patentsview.org/apis/purpose",
    upstream: "https://patentsview.org/",
    coverage: "US patent grant records.",
    limitation: "Research discovery only. Verify current API access, response contract and patent-family coverage; not a legal freedom-to-operate opinion."
  },
  {
    id: "openrouteservice",
    name: "openrouteservice",
    category: "Geospatial / Transportation",
    description: "Directions, points of interest, isochrones, geocoding and elevation services.",
    purpose: "Potential route-distance context for transport planning.",
    auth: "apiKey",
    https: "Yes",
    cors: "Unknown",
    stage: "candidate",
    docs: "https://openrouteservice.org/",
    upstream: "https://github.com/GIScience/openrouteservice",
    coverage: "Global routing service with provider-defined coverage and profile limits.",
    limitation: "Key, quota and provider terms required. Route distance is not a carrier quote or proof of vehicle access, load restrictions or delivery time."
  }
];

const allowedCurrency = /^[A-Z]{3}$/;
const allowedCountry = /^[A-Z]{2}$/;
const allowedDate = /^\d{8}$/;

export function getPublicApiDirectory() {
  return {
    source: PUBLIC_API_SOURCE,
    total: PUBLIC_APIS.length,
    items: PUBLIC_APIS.map(item => ({ ...item }))
  };
}

function inputError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "invalid-public-api-parameters";
  return error;
}

function upstreamError(provider, status, message) {
  const error = new Error(provider + " request failed" + (status ? " (HTTP " + status + ")" : "") + ": " + message);
  error.status = 502;
  error.code = "public-api-upstream-failed";
  return error;
}

async function requestJson(url, provider, fetchImpl, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json", "user-agent": "AXIMACH-public-api-adapter/1.0" },
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    const reason = error?.name === "TimeoutError" || error?.name === "AbortError" ? "request timed out" : "network unavailable";
    throw upstreamError(provider, 0, reason);
  }
  if (!response.ok) throw upstreamError(provider, response.status, "provider did not return a successful response");
  try {
    return await response.json();
  } catch {
    throw upstreamError(provider, response.status, "provider returned invalid JSON");
  }
}

async function cached(key, ttlMs, factory) {
  const previous = CACHE.get(key);
  if (previous && previous.expiresAt > Date.now()) return previous.value;
  const pending = previous?.pending;
  if (pending) return pending;
  const work = Promise.resolve().then(factory);
  CACHE.set(key, { pending: work, expiresAt: 0 });
  try {
    const value = await work;
    CACHE.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  } catch (error) {
    CACHE.delete(key);
    throw error;
  }
}

function parseCurrencyList(value, base) {
  const quotes = String(value || "").split(",").map(item => item.trim().toUpperCase()).filter(Boolean);
  const unique = [...new Set(quotes)];
  if (!unique.length || unique.length > 8 || unique.some(code => !allowedCurrency.test(code) || code === base)) {
    throw inputError("Choose 1–8 distinct quote currency codes (ISO 4217), different from the base currency.");
  }
  return unique;
}

export async function getPublicApiData(kind, params = {}, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") throw upstreamError("Public API", 0, "fetch is unavailable");

  if (kind === "fx") {
    const base = String(params.base || "INR").trim().toUpperCase();
    if (!allowedCurrency.test(base)) throw inputError("Base currency must be a 3-letter ISO 4217 code.");
    const quotes = parseCurrencyList(params.quotes || "USD,EUR,PLN", base);
    const date = String(params.date || "").trim();
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw inputError("Rate date must use YYYY-MM-DD.");
    const query = new URLSearchParams({ base, quotes: quotes.join(",") });
    if (date) query.set("date", date);
    const url = "https://api.frankfurter.dev/v2/rates?" + query.toString();
    const data = await cached("fx:" + url, 6 * 60 * 60 * 1000, async () => {
      const rows = await requestJson(url, "Frankfurter", fetchImpl);
      if (!Array.isArray(rows) || rows.some(row => !row || row.base !== base || !quotes.includes(row.quote) || typeof row.date !== "string" || !Number.isFinite(row.rate) || row.rate <= 0)) {
        throw upstreamError("Frankfurter", 200, "response did not match the expected currency-rate schema");
      }
      return rows;
    });
    return {
      provider: "Frankfurter",
      base,
      quotes,
      date: data.reduce((latest, row) => row.date > latest ? row.date : latest, ""),
      rows: data,
      note: "Reference rates only; not live market quotes, bank execution rates or accounting entries.",
      source: "https://frankfurter.dev/"
    };
  }

  if (kind === "holidays") {
    const country = String(params.country || "IN").trim().toUpperCase();
    const year = Number(params.year || new Date().getFullYear());
    if (!allowedCountry.test(country)) throw inputError("Country must be a 2-letter ISO 3166-1 code.");
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(year) || year < currentYear - 2 || year > currentYear + 4) {
      throw inputError("Holiday year must be between " + (currentYear - 2) + " and " + (currentYear + 4) + ".");
    }
    const url = "https://nagerholidays.com/api/v4/Holidays/" + country + "/" + year;
    const rows = await cached("holidays:" + country + ":" + year, 24 * 60 * 60 * 1000, async () => {
      const data = await requestJson(url, "Nager.Date", fetchImpl);
      if (!Array.isArray(data) || data.some(row => !row || typeof row.date !== "string" || typeof row.name !== "string" || row.countryCode !== country || !Array.isArray(row.holidayTypes))) {
        throw upstreamError("Nager.Date", 200, "response did not match the expected holiday schema");
      }
      return data.slice().sort((a, b) => a.date.localeCompare(b.date));
    });
    return {
      provider: "Nager.Date",
      country,
      year,
      holidays: rows,
      note: "Public calendar reference. Review subdivision codes and your factory/customer working calendar before changing production commitments.",
      source: "https://nagerholidays.com/api"
    };
  }

  if (kind === "ev-stations") {
    const state = String(params.state || "").trim();
    const city = String(params.city || "").trim();
    const page = Number(params.page || 1);
    const limit = Number(params.limit || 20);
    if (state.length < 2 || state.length > 60 || !/^[\p{L}\p{M} .,'()-]+$/u.test(state)) throw inputError("Enter a valid Indian state or union territory name.");
    if (city && (city.length > 80 || !/^[\p{L}\p{M}0-9 .,'()/-]+$/u.test(city))) throw inputError("Enter a valid city/locality name.");
    if (!Number.isInteger(page) || page < 1 || page > 500 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw inputError("Page must be 1–500 and page size must be 1–50.");
    }
    const query = new URLSearchParams({ state, page: String(page), limit: String(limit), location_quality: "ok" });
    if (city) query.set("city", city);
    const url = "https://ev-charging-stations-api.vercel.app/v1/stations?" + query.toString();
    const result = await cached("ev:" + url, 30 * 60 * 1000, async () => {
      const data = await requestJson(url, "India EV Charging Station Directory", fetchImpl);
      if (!data || data.success !== true || !Array.isArray(data.data) || !data.meta || !data.meta.source || typeof data.meta.attribution !== "string") {
        throw upstreamError("India EV Charging Station Directory", 200, "response did not match the expected station schema");
      }
      return {
        stations: data.data.map(row => ({
          id: String(row.id || ""),
          operator: String(row.operator || "Operator not recorded"),
          ownership: String(row.ownership || "Unknown"),
          state: String(row.state || ""),
          district: String(row.district || ""),
          city: String(row.city || ""),
          address: String(row.address || "Address not recorded"),
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          locationQuality: String(row.location_quality || "unknown"),
          connectors: Array.isArray(row.standards) ? row.standards.slice(0, 12) : [],
          currents: Array.isArray(row.currents) ? row.currents.slice(0, 4) : [],
          maxPowerKw: Number.isFinite(Number(row.max_power_kw)) ? Number(row.max_power_kw) : null,
          distanceKm: Number.isFinite(Number(row.distance_km)) ? Number(row.distance_km) : null
        })),
        meta: {
          page: Number(data.meta.page || page),
          limit: Number(data.meta.limit || limit),
          totalFound: Number(data.meta.total_found || 0),
          totalPages: Number(data.meta.total_pages || 0),
          source: data.meta.source,
          attribution: data.meta.attribution
        }
      };
    });
    return {
      provider: "India EV Charging Station Directory",
      state,
      city,
      ...result,
      note: "Historical directory snapshot dated 26 October 2025. It does not report live charger availability, tariffs or opening hours. Verify the station before dispatch.",
      source: "https://ev-charging-stations-api.vercel.app/docs"
    };
  }

  throw inputError("Unknown public API adapter. Supported adapters: fx, holidays, ev-stations.");
}

export function clearPublicApiCacheForTests() {
  CACHE.clear();
}
