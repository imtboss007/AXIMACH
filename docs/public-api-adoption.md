# AXIMACH — Public API adoption register

## Source

- Directory: [public-apis/public-apis](https://github.com/public-apis/public-apis)
- Directory file: [README.md](https://github.com/public-apis/public-apis/blob/master/README.md)
- Directory licence: MIT (the licence applies to the directory repository's own content, not to external providers' APIs, data or terms).
- AXIMACH implementation: `server/integrations/public-apis.mjs`, `src/IntegrationHubWorkspace.tsx`.

The upstream project is a community-maintained directory. It is not an API gateway, provider SDK, uptime guarantee or blanket licence for the listed services. AXIMACH keeps a deliberately small manufacturing-oriented subset; it does not import or activate the whole catalogue.

## Live read-only adapters

| Provider | AXIMACH use | Access | Important limitation |
|---|---|---|---|
| Frankfurter | Supplier currency reference for imported material / export quote comparisons | No API key | Reference rates only, not executable bank or market quotes. Rate date is displayed. No automatic posting to costing/accounting. |
| Nager.Date v4 | Public holiday reference for factory working-day and supplier lead-time review | No API key | Country and first-level subdivisions only where supplied. Verify Karnataka/company/customer calendars before changing delivery commitments. |
| India EV Charging Station Directory | Optional EV fleet/transport location lookup, state/city filtered | No API key | Third-party republishing of a BEE dataset snapshot dated 26 October 2025. Not an official BEE service; no live charger availability, price or hours. Attribution is retained in the result UI. |

### Server controls

- All three providers are called only by the AXIMACH shared-data server through fixed HTTPS origins and fixed adapter routes.
- AXIMACH never accepts an arbitrary upstream URL from a user, preventing this feature from becoming an open proxy.
- Calls are administrator-only, read-only, bounded by input validation and provider timeouts, and cached server-side.
- Request outcomes are recorded in the existing audit-event store; returned provider data never changes PO, supplier, material, route, costing or schedule records.
- Provider errors are normalised; credentials are never exposed in the browser.
- No new runtime package or provider API key was added.

## Optional candidates — not connected

| Provider | Potential use | Current status / gate |
|---|---|---|
| NASA POWER | Factory-site solar resource / historical climate context | Candidate. Confirm variable, units, temporal resolution and dataset update lag; not live plant telemetry. |
| gstinapi.in | Supplier GSTIN/PAN verification | Candidate only. Private third-party service, not GSTN/Government of India. Requires server-side key, credit/quota review, privacy/legal review and explicit admin setup. |
| Vibe Manufacturing | Manufacturer/supplier discovery | Review required. Confirm identity, API contract, data provenance, licence, reliability and permitted commercial use. |
| NHTSA vPIC | US vehicle make/model/product reference | Candidate. US-specific reference; not global vehicle compatibility or engineering approval. |
| PatentsView | US patent / prior-art discovery | Candidate. Confirm current API contract and terms; research only, not a legal freedom-to-operate opinion. |
| openrouteservice | Transport distance/route context | Candidate. API key, provider quotas and terms required. A route estimate is not a carrier quote or guaranteed delivery time. |

## Deliberately not enabled

- Provider credentials, paid accounts, commercial credits or secret values are not provisioned by this integration.
- Supplier/customer master records and manufacturing commitments are not automatically updated from third-party data.
- APIs requiring an approval, registration or data agreement stay as candidates until reviewed.
- The 111-entry technology/repository inventory remains a separate source register; this file records the additional upstream API directory supplied for this task.
