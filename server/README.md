# AXIMACH Scheduler Service

This optional Node.js service runs scheduled WhatsApp **individual** messages independently of the AXIMACH UI, as long as this service is deployed on an always-on host with persistent storage.

## Required environment variables

- `AXIMACH_API_KEY`: strong random secret used by the UI/API caller.
- `WHATSAPP_ACCESS_TOKEN`: Meta WhatsApp Cloud API access token.
- `WHATSAPP_PHONE_NUMBER_ID`: phone-number ID from the Meta WhatsApp Business platform.
- `AXIMACH_DATA_FILE`: persistent file path, e.g. `/data/aximach.json` on a host with a persistent disk.
- `AXIMACH_ALLOWED_ORIGINS`: comma-separated exact origins allowed to call the API; use only the web/desktop/mobile origins you operate and never use `*`.
- `AXIMACH_ALLOWED_ORIGIN`: backward-compatible single-origin setting when `AXIMACH_ALLOWED_ORIGINS` is not set.
- `PORT`: optional; defaults to 8787.
- `WHATSAPP_GRAPH_VERSION`: optional Graph API version; defaults to v23.0.

Run with Node.js 20.18+: `node server/index.mjs`.

## API

All routes except `GET /health` require header `x-aximach-key: <AXIMACH_API_KEY>`.

- `GET /api/manufacturing-data` — read the linked company/factory/PO/component/vendor/operation/quotation/material/BOM/inventory/machine-resource/maintenance collections.
- `PUT /api/manufacturing-data` — merge linked manufacturing records by stable record ID and `updatedAt` into the persistent JSON store (maximum 8 MB per payload; archive records with a `deletedAt` timestamp to retain history).
- `GET /api/records` — read all generic module records by module ID.
- `PUT /api/records` JSON: `{"records":{"companies":[{"id":"...","title":"Example","updatedAt":"..."}]}}` — persist module records server-side (maximum 8 MB per payload).
- `GET /api/contacts`
- `POST /api/contacts` JSON: `{"name":"Vendor","phone":"9198XXXXXXXX","company":"Example","optedIn":true}`
- `GET /api/schedules`
- `POST /api/schedules` JSON: `{"to":"9198XXXXXXXX","message":"Approved message","nextRunAt":"2030-01-01T09:00:00.000Z","repeat":"once"}`; repeat can be `once`, `daily`, or `weekly`.
- `PATCH /api/schedules/:id` JSON: `{"enabled":false}`
- `GET /api/logs`

## Important limits

- This service uses the official Meta WhatsApp Cloud API, not a WhatsApp Web QR-session hack. You must configure a WhatsApp Business sender, credentials, recipient opt-in and any template requirements that apply to messages outside the customer-service window.
- The official Cloud API does not provide general personal-account contact sync by QR and does not support arbitrary WhatsApp group sends in this service. Contacts are imported/entered by the operator; group messages are intentionally not implemented.
- A successful API response means accepted by the provider, not proof of delivery or a reply. Delivery/reply webhooks still need to be configured before status can be marked delivered/replied.
- The scheduler only continues while this service is running. Deploy it to an always-on host and use persistent disk; a sleeping/free host or ephemeral disk cannot guarantee schedules/data. The UI itself can be closed.
- Never expose the API key or Meta access token in frontend code. Keep secrets in the host's environment variables.


## Container deployment

A scheduler container definition is available at the repository root as `Dockerfile.scheduler`. Build it with:

```sh
docker build -f Dockerfile.scheduler -t aximach-scheduler .
docker run --name aximach-scheduler -p 8787:8787 \
  -e AXIMACH_API_KEY='use-a-long-random-secret' \
  -e AXIMACH_ALLOWED_ORIGINS='https://your-aximach-app.example.com,http://localhost:5173' \
  -e WHATSAPP_ACCESS_TOKEN='set-through-host-secrets' \
  -e WHATSAPP_PHONE_NUMBER_ID='set-through-host-secrets' \
  -v aximach-data:/data aximach-scheduler
```

Use your host's secret manager instead of putting real credentials in shell history. The volume must be persistent and backups should be configured. Put the service behind HTTPS.

For the QR-paired bridge, build the separate container from the repository root with `docker build -f Dockerfile.whatsapp -t aximach-whatsapp .`. Run it with port 8788 exposed and a persistent volume mounted at `/data`; set `AXIMACH_API_KEY` and `AXIMACH_ALLOWED_ORIGIN` as environment variables. Keep `/data/whatsapp-auth` private and backed up securely. The Follow-up Centre's **QR-paired WhatsApp account** panel uses the bridge URL and API key. Use the same explicit allowed-origin list for the bridge service and scheduler API. When the scheduler API is connected, AXIMACH pushes existing local manufacturing master data to the persistent API; newly synced QR contacts are then upserted into the canonical vendor master. Connection settings are retained locally and the panel attempts to reconnect when reopened.

## Frontend connection and security

The Communication & Follow-up screen can connect to this API, add contacts with explicit opt-in, create one-time/daily/weekly individual schedules, pause/resume schedules, refresh records and export contacts as CSV. Generic module records sync to `/api/records`; linked manufacturing master records sync separately to `/api/manufacturing-data`. The browser keeps a local cache for continuity. The API key and server URL are stored in this browser/device local storage, so protect the device and do not use this single shared key as a production multi-user permission system. This is a connector prototype, **not a multi-user security boundary**: anyone allowed to use the UI can potentially inspect/use that key. Do not expose this configuration to untrusted users or deploy it publicly without adding real user authentication, per-user authorization and a server-side session/proxy.

The current scheduler does not sync a phone's WhatsApp address book, pair via QR/linked devices, send to WhatsApp groups, or stop repeated messages on a reply. Those require supported provider capabilities and additional webhook/state handling. Do not configure repeat messages without appropriate recipient consent and a clear stop/pause process.


## QR-paired personal WhatsApp bridge (unofficial)

AXIMACH now includes an optional Baileys-based WhatsApp Web bridge in `server/whatsapp-web.mjs`. It is separate from the official Cloud API scheduler and must run as its own long-lived process:

```sh
npm install
AXIMACH_API_KEY='use-a-long-random-secret' WA_WEB_DATA_FILE='/data/whatsapp-web.json' WA_WEB_AUTH_DIR='/data/whatsapp-auth' npm run start:whatsapp-web
```

Set `WA_WEB_PORT` (default 8788), `AXIMACH_API_KEY`, `AXIMACH_ALLOWED_ORIGIN`, `WA_WEB_DATA_FILE`, and `WA_WEB_AUTH_DIR`. Mount both data and auth paths on a **persistent disk**. The WhatsApp linked-device credentials are highly sensitive; do not expose the auth directory or QR/status endpoint publicly, and put the service behind HTTPS. Use the same API key as the UI only in a trusted deployment.

Endpoints (all except `GET /health` require `x-aximach-key`):
- `GET /api/whatsapp/status` — connection state and QR payload while pairing.
- `GET /api/whatsapp/contacts` — contacts learned from WhatsApp contact/history sync.
- `GET /api/whatsapp/groups` — participating groups.
- `POST /api/whatsapp/send` — JSON `{"to":"9198XXXXXXXX","message":"Hello","optedIn":true}`; `to` may be a group JID for group messages.
- `GET /api/whatsapp/schedules`, `POST /api/whatsapp/schedules` and `PATCH /api/whatsapp/schedules/:id` — persistent one-time/daily/weekly schedules. Include `optedIn:true` when creating a schedule.
- `POST /api/whatsapp/refresh-groups` — refresh group list.

The bridge persists the linked-device auth state and schedule/contact cache to disk and reconnects after temporary disconnects. The phone/app can be closed while this server remains running. If the server host sleeps, is shut down, loses its persistent volume, or WhatsApp logs the linked device out, schedules will not run until restored/reconnected. This bridge is based on an **unofficial WhatsApp Web protocol library**, not a WhatsApp/Meta-supported API; account restriction or breakage is possible. Use only with an account you control, respect WhatsApp rules, recipient consent, and rate limits. Contact sync is best-effort and depends on what WhatsApp sync events make available; it cannot guarantee every phone address-book entry is exposed. Do not send unsolicited or bulk messages.

This is an API/service integration commit, not yet a claim that a QR scanner UI, all-device record synchronization, delivery/reply webhooks, or production hosting has been completed or verified.
