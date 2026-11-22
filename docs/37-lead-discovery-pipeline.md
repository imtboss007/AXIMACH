# AXIMACH — Multi-source Public-Web Lead Discovery

**Status:** implemented in the existing Customer Directory workflow as multi-instance SearXNG search plus a single-page, administrator-allowlisted official website metadata capture. Provider configuration and live-source operation remain unverified until configured on the shared server.

## Purpose and operating flow

AXIMACH uses the existing **Customer Directory → Lead Discovery** workspace. It searches for possible OEM, Tier-1/Tier-2, industrial machinery, automation, automotive, aerospace, electrical, defence and medical-device buyers. Search results are unverified prospects, not customer records.

1. A user selects the AXIMACH operating company that owns the prospect relationship.
2. The server fans the query out to up to five configured self-hosted SearXNG search instances. Each instance can use its enabled public web search engines.
3. AXIMACH combines results, deduplicates canonical source URLs and reports which configured search sources succeeded or failed. Partial results are retained when at least one source is available.
4. The user can save a result as an unqualified prospect.
5. The user may explicitly request metadata enrichment for one selected HTTPS result URL. The server fetches only that one page when its hostname is on the administrator's allowlist.
6. AXIMACH extracts a limited set of public company metadata: page title, site name, description and Schema.org Organization fields (name, legal name, website and public sameAs links). Email addresses, phone numbers and page scripts are not returned.
7. Search and official-website captures are stored as separate source-evidence records. The prospect must be reviewed and qualified by a person before the existing **Promote to customer** action is enabled. Promoted customers start **On hold**.

Changing the selected owning company clears transient search results and website enrichment in the panel.

## Server-only configuration

Configure these variables on the **AXIMACH shared server**, never in browser code or localStorage.

```env
# Preferred: semicolon/comma/newline-separated URLs; maximum five unique instances.
AXIMACH_SEARXNG_URLS=https://search-one.example;https://search-two.example

# Backward-compatible single-instance setting; used when AXIMACH_SEARXNG_URLS is empty.
AXIMACH_SEARXNG_URL=https://your-private-searxng-host

# Exact hostnames or wildcard subdomains approved for single-page metadata capture.
AXIMACH_DISCOVERY_ALLOWED_HOSTS=company-one.example;*.company-two.example
```

Each SearXNG value must be a base HTTP(S) URL without credentials. AXIMACH appends `/search` and requests `format=json`, safe-search enabled and page 1. JSON output must be enabled in every SearXNG instance's `settings.yml`. Instances should be private to the AXIMACH server or protected behind an authenticated/private network boundary. Do not place service credentials in browser storage or public bundles.

The hostname allowlist is an explicit administrator approval boundary. It supports exact hostnames and `*.example.com` patterns (which include the apex host). Website enrichment accepts HTTPS only on the standard port, rejects credentials and IP-literal URLs, resolves the hostname and rejects the request if any returned address is non-public, pins the HTTPS request to the checked DNS addresses, blocks redirects, requires HTML, and caps the response at 1 MB with a 10-second timeout. Administrators must approve only domains and pages whose public access is permitted by their terms and applicable site policies.

## APIs, permissions and evidence

- `POST /api/lead-discovery/search` — `{ "query": "...", "ownerCompanyId": "..." }`.
- `POST /api/lead-discovery/enrich` — `{ "url": "...", "ownerCompanyId": "..." }`.
- Both endpoints require normal AXIMACH authentication, `data:read` permission and visibility of the selected owning company.
- The server checks tenant/company visibility before calling a provider or requesting the website.
- Search audit events record provider, owning company and result count, not the raw query. Website audit events record the provider, owning company and approved source domain, not page content.
- Search results and enrichment payloads remain transient until the user saves them into the prospect evidence list.
- Prospects remain separate from customers. Existing human qualification and customer promotion rules are unchanged.
- Prospect evidence is capped at 20 source records per prospect. A source URL is evidence, not proof of legal identity, buyer authority or commercial fit.

## Safety boundaries

- No bulk website crawler, recursive link traversal, page-wide data dump, private-contact harvesting, email/phone discovery, email verification, automated outreach or CRM export is included.
- Website enrichment is a single user-selected page fetch on a hostname explicitly approved by the AXIMACH administrator.
- Search and page content are untrusted external input. They are rendered as text and never treated as executable instructions or authority to change AXIMACH records.
- No LinkedIn logged-in scraping, access-control bypass, paid provider connection, paid API, deployment or public release is included.
- Search results and source metadata must be reviewed for freshness, relevance, official identity, legal entity name and ownership before qualification. Verify GSTIN (where applicable), actual buyer contacts and commercial terms independently.

## Tests and verification boundary

Unit tests cover multi-instance fan-out, URL deduplication, partial source failure, total provider failure, SearXNG JSON mode, result filtering, official-website allowlist checks, public-DNS checks, HTTPS-only requests, redirect rejection, metadata extraction and omission of email/phone fields. These tests use mocked providers and DNS/HTTP responses. They do not prove that a live SearXNG service or an approved website is configured, reachable or currently returning results.

## Remaining pipeline work

- Optional registry and public-business-directory adapters require exact source terms, licence/data-rights checks and separate tests.
- Full-site crawling and page discovery are not included; add only as a later, bounded allowlisted crawl with robots/terms compliance and page/depth/rate limits.
- Decision-maker discovery and direct contact enrichment are not included. Use official company leadership pages and permitted public sources only in a separately reviewed workflow; do not harvest private data.
- Matching against detailed AXIMACH customer requirements, confidence scoring, manual evidence review and bulk prospect workflow still need their own implementation and acceptance.
