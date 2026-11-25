import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

function fail(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function cleanText(value, max) {
  let cleaned = "";
  for (const character of String(value ?? "")) {
    const code = character.charCodeAt(0);
    cleaned += code < 32 || code === 127 ? " " : character;
  }
  return cleaned.split(" ").filter(Boolean).join(" ").trim().slice(0, max);
}

function publicResultUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    let host = url.hostname.toLowerCase();
    if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
        host === "::1" || (host.includes(":") && (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")))) return "";
    const octets = host.split(".").map(Number);
    if (octets.length === 4 && octets.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
      const [a, b, c] = octets;
      if (a === 0 || a === 10 || a === 127 || a >= 224 ||
          (a === 100 && b >= 64 && b <= 127) ||
          (a === 169 && b === 254) ||
          (a === 172 && b >= 16 && b <= 31) ||
          (a === 192 && (b === 168 || (b === 0 && c <= 2) || (b === 88 && c === 99))) ||
          (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
          (a === 203 && b === 0 && c === 113)) return "";
    }
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function configuredSearxngEndpoints(env) {
  const configured = String(env.AXIMACH_SEARXNG_URLS || env.AXIMACH_SEARXNG_URL || "").trim();
  if (!configured) {
    throw fail(503, "not-configured", "SearXNG is not configured. Set AXIMACH_SEARXNG_URLS or AXIMACH_SEARXNG_URL on the shared AXIMACH server.");
  }
  const rawEndpoints = configured.split(/[;,\n]/).map(value => value.trim()).filter(Boolean).slice(0, 5);
  const endpoints = [];
  const seen = new Set();
  for (const value of rawEndpoints) {
    try {
      const endpoint = new URL(value);
      if (!["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error("invalid");
      endpoint.search = "";
      endpoint.hash = "";
      let suffix = endpoint.pathname;
      while (suffix.endsWith("/")) suffix = suffix.slice(0, -1);
      if (!suffix.toLowerCase().endsWith("/search")) suffix += "/search";
      endpoint.pathname = suffix || "/search";
      const canonical = endpoint.toString();
      if (!seen.has(canonical)) {
        seen.add(canonical);
        endpoints.push(endpoint);
      }
    } catch {
      throw fail(503, "invalid-configuration", "Every SearXNG endpoint must be a valid HTTP(S) base URL without credentials.");
    }
  }
  if (!endpoints.length) throw fail(503, "not-configured", "No SearXNG search endpoints are configured.");
  return endpoints;
}

async function searchOneSearxng(endpoint, term, fetchImpl, sourceId) {
  let response;
  try {
    response = await fetchImpl(endpoint.toString(), {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    throw fail(502, "provider-unavailable", "AXIMACH could not reach one configured SearXNG service.");
  }
  if (!response.ok) {
    if (response.status === 403) throw fail(502, "json-disabled", "A SearXNG service rejected JSON output. Enable the json format in that instance's settings.yml.");
    throw fail(502, "provider-error", "A SearXNG service returned HTTP " + response.status + ".");
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw fail(502, "invalid-response", "A SearXNG service did not return valid JSON.");
  }
  if (!payload || !Array.isArray(payload.results)) {
    throw fail(502, "invalid-response", "A SearXNG response did not contain a results array.");
  }
  const results = [];
  const seen = new Set();
  for (const item of payload.results) {
    if (!item || typeof item !== "object") continue;
    const url = publicResultUrl(item.url);
    const title = cleanText(item.title, 240);
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    const engines = Array.isArray(item.engines) ? item.engines : [];
    results.push({
      title,
      url,
      content: cleanText(item.content, 1200),
      engine: cleanText(engines.join(", "), 120),
      sourceId,
      ...(item.publishedDate || item.published_date
        ? { publishedDate: cleanText(item.publishedDate || item.published_date, 80) }
        : {})
    });
    if (results.length === 10) break;
  }
  return results;
}

export async function searchSearxng(query, { env = process.env, fetchImpl = fetch, now = () => new Date() } = {}) {
  const term = cleanText(query, 241);
  if (term.length < 3 || term.length > 240) {
    throw fail(400, "invalid-query", "Search query must contain between 3 and 240 characters.");
  }
  const endpoints = configuredSearxngEndpoints(env);
  const outcomes = await Promise.all(endpoints.map(async (endpoint, index) => {
    const id = "searxng-" + (index + 1);
    const source = { id, label: "Search source " + (index + 1), status: "ok", resultCount: 0 };
    try {
      endpoint.searchParams.set("q", term);
      endpoint.searchParams.set("format", "json");
      endpoint.searchParams.set("safesearch", "1");
      endpoint.searchParams.set("pageno", "1");
      const results = await searchOneSearxng(endpoint, term, fetchImpl, id);
      source.resultCount = results.length;
      return { source, results, error: null };
    } catch (error) {
      source.status = "error";
      source.errorCode = error.code || "provider-unavailable";
      return { source, results: [], error };
    }
  }));
  const successful = outcomes.filter(item => !item.error);
  if (!successful.length) throw outcomes[0]?.error || fail(502, "provider-unavailable", "No configured public-web search source is available.");

  const combined = new Map();
  for (const outcome of successful) {
    for (const result of outcome.results) {
      const current = combined.get(result.url);
      if (!current) {
        combined.set(result.url, result);
        continue;
      }
      const engines = [...new Set([current.engine, result.engine].filter(Boolean))].join(", ");
      const sourceIds = [...new Set([current.sourceId, result.sourceId])];
      combined.set(result.url, { ...current, engine: engines, sourceId: sourceIds.join(",") });
    }
  }
  return {
    provider: "SearXNG",
    query: term,
    retrievedAt: now().toISOString(),
    sources: outcomes.map(item => item.source),
    partialFailure: successful.length !== outcomes.length,
    results: [...combined.values()].slice(0, 50)
  };
}

function isPublicAddress(address) {
  const family = isIP(String(address || ""));
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && c <= 2) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (family === 6) {
    const value = address.toLowerCase();
    if (value.startsWith("::ffff:")) return isPublicAddress(value.slice(7));
    return (value.startsWith("2") || value.startsWith("3")) &&
      !value.startsWith("2001:db8:") && !value.startsWith("2001:0000:");
  }
  return false;
}

function isAllowedHost(hostname, env) {
  const configured = String(env.AXIMACH_DISCOVERY_ALLOWED_HOSTS || "").trim();
  if (!configured) throw fail(503, "website-enrichment-not-configured", "Official website enrichment is disabled. Configure AXIMACH_DISCOVERY_ALLOWED_HOSTS on the AXIMACH server.");
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const patterns = configured.split(/[;,\n]/).map(value => value.trim().toLowerCase()).filter(Boolean);
  return patterns.some(pattern => {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(2).replace(/\.$/, "");
      return host === suffix || host.endsWith("." + suffix);
    }
    return host === pattern.replace(/\.$/, "");
  });
}

function requestApprovedWebsitePage(url, addresses) {
  return new Promise((resolve, reject) => {
    const selected = addresses[0];
    const request = httpsRequest(url, {
      method: "GET",
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9",
        "user-agent": "AXIMACH-Public-Company-Metadata/1.0"
      },
      maxHeaderSize: 16384,
      timeout: 10000,
      lookup: (_hostname, options, callback) => {
        if (options?.all) callback(null, addresses);
        else callback(null, selected.address, selected.family);
      }
    }, response => {
      const status = Number(response.statusCode || 0);
      const contentType = String(response.headers["content-type"] || "").toLowerCase();
      const length = Number(response.headers["content-length"] || 0);
      if (status >= 300 && status < 400) {
        response.resume();
        reject(fail(502, "website-redirect-blocked", "Website redirects are blocked. Save and review the final HTTPS address, then retry."));
        return;
      }
      if (status !== 200) {
        response.resume();
        reject(fail(status === 404 ? 404 : 502, "website-http-error", "The approved website returned HTTP " + status + "."));
        return;
      }
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        response.resume();
        reject(fail(415, "website-not-html", "The selected URL did not return an HTML page."));
        return;
      }
      if (Number.isFinite(length) && length > 1000000) {
        response.resume();
        reject(fail(413, "website-too-large", "The selected page exceeds the 1 MB metadata-fetch limit."));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on("data", chunk => {
        size += chunk.length;
        if (size > 1000000) {
          response.destroy();
          reject(fail(413, "website-too-large", "The selected page exceeds the 1 MB metadata-fetch limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      response.on("error", () => reject(fail(502, "website-fetch-failed", "The approved website could not be read.")));
    });
    request.on("timeout", () => request.destroy(fail(504, "website-timeout", "The approved website did not respond within 10 seconds.")));
    request.on("error", error => reject(error.status ? error : fail(502, "website-fetch-failed", "The approved website could not be reached.")));
    request.end();
  });
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, number) => String.fromCodePoint(Math.min(0x10ffff, Number(number))))
    .replace(/&#x([a-f0-9]+);/gi, (_match, number) => String.fromCodePoint(Math.min(0x10ffff, parseInt(number, 16))));
}

function plainText(value, max = 500) {
  return cleanText(decodeHtml(String(value || "").replace(/<[^>]*>/g, " ")), max);
}

function attributes(tag) {
  const found = {};
  for (const match of tag.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    found[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return found;
}

function metaContent(html, names) {
  const wanted = new Set(names.map(value => value.toLowerCase()));
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = attributes(tag);
    if (wanted.has(String(attrs.name || attrs.property || "").toLowerCase()) && attrs.content) return plainText(attrs.content, 600);
  }
  return "";
}

function findOrganization(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findOrganization(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const rawTypes = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"] || ""];
  if (rawTypes.some(type => /organization|corporation|localbusiness|professionalservice/i.test(String(type)))) return value;
  for (const item of Object.values(value)) {
    const found = findOrganization(item);
    if (found) return found;
  }
  return null;
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.username || url.password || isIP(url.hostname)) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function extractWebsiteMetadata(html, pageUrl, now) {
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = plainText(titleMatch?.[1] || metaContent(html, ["og:title"]), 240);
  const siteName = metaContent(html, ["og:site_name", "application-name"]);
  let description = metaContent(html, ["description", "og:description"]);
  let organization = null;
  const scripts = html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const script of scripts.slice(0, 10)) {
    const jsonText = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const candidate = findOrganization(JSON.parse(jsonText));
      if (candidate) {
        organization = {
          ...(plainText(candidate.name, 240) ? { name: plainText(candidate.name, 240) } : {}),
          ...(plainText(candidate.legalName, 240) ? { legalName: plainText(candidate.legalName, 240) } : {}),
          ...(safeHttpsUrl(candidate.url) ? { url: safeHttpsUrl(candidate.url) } : {}),
          ...(plainText(candidate.description, 600) ? { description: plainText(candidate.description, 600) } : {}),
          ...(Array.isArray(candidate.sameAs)
            ? { sameAs: candidate.sameAs.map(safeHttpsUrl).filter(Boolean).slice(0, 8) }
            : {})
        };
        break;
      }
    } catch {
      // Malformed JSON-LD is ignored; raw page content is never returned.
    }
  }
  if (!description && organization?.description) description = organization.description;
  return {
    provider: "Official website",
    url: pageUrl,
    retrievedAt: now().toISOString(),
    title,
    siteName,
    description,
    ...(organization ? { organization } : {})
  };
}

export async function enrichOfficialWebsite(rawUrl, {
  env = process.env,
  lookupImpl = dnsLookup,
  requestImpl = requestApprovedWebsitePage,
  now = () => new Date()
} = {}) {
  let pageUrl;
  try {
    pageUrl = new URL(String(rawUrl || ""));
  } catch {
    throw fail(400, "invalid-website-url", "Enter a valid official HTTPS website URL.");
  }
  if (pageUrl.protocol !== "https:" || pageUrl.username || pageUrl.password ||
      (pageUrl.port && pageUrl.port !== "443") || !pageUrl.hostname || isIP(pageUrl.hostname)) {
    throw fail(400, "invalid-website-url", "Only public HTTPS website URLs on the standard port are accepted.");
  }
  pageUrl.hash = "";
  const hostname = pageUrl.hostname.toLowerCase().replace(/\.$/, "");
  if (!isAllowedHost(hostname, env)) {
    throw fail(403, "host-not-allowlisted", "This website domain has not been approved by the AXIMACH administrator.");
  }
  let addresses;
  try {
    addresses = await lookupImpl(hostname, { all: true, verbatim: true });
  } catch {
    throw fail(502, "website-dns-failed", "The approved website hostname could not be resolved.");
  }
  if (!Array.isArray(addresses) || !addresses.length || addresses.some(row => !isPublicAddress(row.address))) {
    throw fail(403, "non-public-website-host", "The selected host resolves to a non-public or unsupported network address and was blocked.");
  }
  const html = await requestImpl(pageUrl, addresses);
  return extractWebsiteMetadata(String(html || ""), pageUrl.toString(), now);
}
