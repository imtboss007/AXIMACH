# AXIMACH — Public-Web Lead Discovery (Initial Integration)

**Status:** implemented as a self-hosted SearXNG search adapter and a tenant-scoped prospect workflow. A live SearXNG provider is not yet configured or health-verified.

## Purpose

Lead Discovery is part of **Customer Directory**. It searches public web indexes for possible OEM, Tier-1/Tier-2, industrial machinery, automation, automotive, aerospace, electrical, defence and medical-device buyers. It does not create customer accounts directly from search results.

AXIMACH remains the canonical customer and manufacturing system. Prospects are a separate collection, with stable IDs and source evidence, until a user reviews and qualifies them.

## Current flow

1. A user opens **Customer Directory → Lead Discovery**.
2. The user selects an AXIMACH operating company that owns the prospect relationship.
3. The user submits a search query to the AXIMACH server.
4. The server sends a JSON search request to the configured SearXNG instance and returns up to ten public web results.
5. The user chooses which result to save. AXIMACH stores a prospect with the query, provider, source URL, result title/snippet, retrieval timestamp and available engine/publication metadata.
6. The prospect moves through **New → Reviewed → Qualified** or **Disqualified**.
7. Only the explicit **Promote to customer** action on a Qualified prospect creates a customer record. The created customer starts **On hold**, retains the source URLs in its notes, and requires identity/contact/commercial verification before activation.

Changing the selected owning company clears the currently displayed search results to prevent saving a previous company's results into a different company scope.

## Provider configuration

Set this variable on the **AXIMACH server only**:

```env
AXIMACH_SEARXNG_URL=https://your-private-searxng-host
```

The value must be a base HTTP(S) URL without credentials. The adapter appends `/search` and requests `format=json`, safe-search enabled and page 1. In the SearXNG instance's `settings.yml`, JSON output must be enabled under the server's configured search formats. The Integration Hub's readiness state only indicates whether the URL is configured; it does not perform a health check.

Keep the SearXNG instance private to the AXIMACH server or behind an authenticated/private network boundary. Do not expose a SearXNG API key or service credential in browser code, localStorage or a public client bundle. The AXIMACH proxy uses a 12-second request timeout and does not follow redirects.

## API and permissions

- Endpoint: `POST /api/lead-discovery/search`
- Request: `{ "query": "...", "ownerCompanyId": "..." }`
- Permission: `data:read` plus the normal AXIMACH account authentication and assigned-company scope.
- The server verifies that the requested owning company is visible to the caller before it sends the search request.
- Search activity is recorded in AXIMACH's audit log with the provider, owning company and result count. The raw query is not written to that audit event.
- Search results are transient until a user saves one as a prospect.
- Prospect and customer records are stored in the canonical manufacturing-data document and use the existing server sync path.
- Tenant filtering and writes restrict customer/prospect visibility to their `ownerCompanyId`. Legacy customer rows without an owner remain visible to administrators; they are not silently assigned to a tenant.

## Safety and data-handling rules

- Search results are unverified leads, not verified companies or approved customers.
- The first integration stores only publicly returned search metadata and source evidence. It does not crawl result pages, harvest private contact details, bypass access controls, create accounts, or send outreach.
- Only HTTP(S) result URLs without embedded credentials are displayed/saved; obvious local/private URL patterns are filtered before results are returned. A saved URL is evidence, not proof of identity or ownership.
- Evidence is capped at 20 source items per prospect. Users should inspect source freshness, official company identity and relevance before qualification.
- A promoted customer is initially On hold. The user must verify legal name, official website, relevant buyer/contact details, GSTIN where applicable, and commercial terms before activation.
- Search results and page content are untrusted external input. They must never be treated as executable instructions or as authority to modify AXIMACH records.

## Tests and verification boundary

The repository tests cover request construction, JSON mode, response normalization, result count limits, obvious private/non-web URL filtering, missing configuration, disabled JSON output, permission mapping, tenant isolation and the prospect/customer qualification flow.

The CI tests use a mocked SearXNG response. **They do not prove that a live SearXNG instance is deployed, configured, reachable or returning current results.** A live provider smoke check remains pending until an administrator supplies the server-side URL and the connected environment is available.

## Explicitly not part of this initial slice

- Crawl4AI or any other page crawler/content extractor.
- Email/phone enrichment or email verification.
- Automated outreach, bulk messaging or third-party CRM sync.
- Apollo, Apify or other paid provider connections.
- Automatic conversion of search results into Customer Directory records.
- Deployment or public release.

These can be evaluated later as separate adapters, with source/licence and provider-term review, data provenance, tenant scope, explicit user actions and their own tests.
