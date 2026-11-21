# AXIMACH Scheduler Service

This optional Node.js service runs scheduled WhatsApp **individual** messages independently of the AXIMACH UI, as long as this service is deployed on an always-on host with persistent storage.

## Required environment variables

- `AXIMACH_API_KEY`: strong random secret used by the legacy shared-key connector. It is ignored when `AXIMACH_AUTH_USERS` is configured.
- `AXIMACH_AUTH_USERS`: optional JSON array of account records containing `id`, `username`, `passwordHash`, `role` and optional `active`. Setting this variable enables bearer-session authentication and disables shared-key access to the scheduler API.
- `AXIMACH_SESSION_TTL_MS`: optional bearer-session lifetime in milliseconds (5 minutes to 7 days; default 12 hours). Sessions are held in memory and are revoked when the server restarts.
- `WHATSAPP_ACCESS_TOKEN`: Meta WhatsApp Cloud API access token.
- `WHATSAPP_PHONE_NUMBER_ID`: phone-number ID from the Meta WhatsApp Business platform.
- `AXIMACH_DATA_FILE`: persistent file path, e.g. `/data/aximach.json` on a host with a persistent disk.
- `AXIMACH_ALLOWED_ORIGINS`: comma-separated exact origins allowed to call the API; use only the web/desktop/mobile origins you operate and never use `*`. Include the deployed web-app origin and `https://localhost` for the default Capacitor Android WebView. Add `capacitor://localhost` only for an iOS Capacitor client. The packaged Electron app uses `Origin: null`; append `null` only if you intentionally enable packaged-desktop access, and keep the API key long, private and restricted to trusted users.
- `AXIMACH_ALLOWED_ORIGIN`: backward-compatible single-origin setting when `AXIMACH_ALLOWED_ORIGINS` is not set.
- `PORT`: optional; defaults to 8787.
- `WHATSAPP_GRAPH_VERSION`: optional Graph API version; defaults to v23.0.

Run with Node.js 20.18+: `node server/index.mjs`.

Create a password-hashed account in an interactive terminal (the password is masked and is not written to a file):

```sh
node server/create-auth-user.mjs --username=admin --role=admin
```

Use the emitted JSON as the value of `AXIMACH_AUTH_USERS` in the server secret manager. Add one object per account to the JSON array. Supported roles are `admin`, `manager`, `operator` and `viewer`. Non-admin users can be scoped by optional `companyIds` and `factoryIds` arrays in each account record. Company scope includes all factories of that company unless explicit factory IDs are provided; factory scope also resolves its parent company. Assign at least one company or factory ID before the user can access manufacturing data. The API exposes `POST /api/auth/login` with username/password, `GET /api/auth/session` and `POST /api/auth/logout`; authenticated API calls use `Authorization: Bearer <token>`. Sessions expire and are stored only in server memory. When `AXIMACH_AUTH_USERS` is set, `x-aximach-key` is not accepted by the scheduler API and the loopback connection-info endpoint does not return the legacy API key.

## API

In legacy mode (no `AXIMACH_AUTH_USERS`), routes require `x-aximach-key: <AXIMACH_API_KEY>`. In user mode, routes require a valid bearer session. Role permissions are enforced server-side: admins can administer, read/write all data, and access backup/restore; managers and operators can read/write only their scoped linked manufacturing data; viewers are read-only within their scope. Unscoped contacts/schedules/logs/preferences, generic legacy module records, and full backup/restore are admin-only until their tenant ownership is modeled.

- `GET /api/manufacturing-data` — read the linked company/factory/PO/component/vendor/operation/quotation collections and the current `restoreGeneration` value.

- `GET /api/records` — read module records and the current `restoreGeneration` value. Both manufacturing-data and module-record PUT requests must send that generation after a restore; stale devices receive HTTP 409 and must refresh from the server before writing.

- `GET /api/backup` — authenticated full JSON backup of the local service database, including manufacturing collections, general module records, contacts, schedules, logs and UI preferences. The response includes a SHA-256 integrity digest.
- `GET /api/audit-events` — admin-only server audit history. Each entry records actor ID/username/role, timestamp, route, action and minimal non-sensitive metadata (such as collection counts or target record ID); business names, contact numbers and message bodies are not copied. The service retains the latest 10,000 events and carries existing audit history forward during restore.

- `POST /api/restore` — authenticated restore of a version-1 AXIMACH backup. Send `{"backup":{...the complete /api/backup response...},"confirmation":"RESTORE_AXIMACH_BACKUP"}`. The service verifies the digest and schema, writes a protected pre-restore snapshot beside the database file, then atomically replaces the database. Invalid/tampered backups and missing confirmation are rejected without changing current data. Mutating requests recheck the restore lock after parsing their request body, and overlapping restore requests are rejected, preventing an in-flight request from saving over the recovered snapshot. Each successful restore increments `restoreGeneration`; manufacturing-data and module-record sync endpoints expose it and reject stale/missing generation writes with HTTP 409 so old device caches cannot resurrect pre-restore records. Keep downloaded backups encrypted and access-controlled; this endpoint does not replace off-host backup retention or disaster-recovery testing.

- `PUT /api/manufacturing-data` — merge linked manufacturing records by stable record ID and `updatedAt` into the persistent JSON store (maximum 8 MB per payload; archive records with a `deletedAt` timestamp to retain history).
- `GET /api/records` — read all generic module records by module ID.
- `PUT /api/records` JSON: `{"records":{"companies":[{"id":"...","title":"Example","updatedAt":"..."}]}}` — merge module records by stable ID and latest `updatedAt`, preserving `deletedAt` tombstones for cross-device removals (maximum 8 MB per payload).
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

The current source client in this branch supports individual-account sign-in from Follow-up Centre. It checks `/health` for the server authentication mode, signs in at `/api/auth/login`, validates the session at `/api/auth/session`, and sends bearer tokens for manufacturing sync; users can sign out to revoke the token. The client keeps the bearer token in browser/device session storage (not the shared API-key localStorage slot), and the server enforces its expiry. Existing packaged Windows/Android releases built before this client migration still use the legacy shared-key connector; update every device to a build containing this change before setting `AXIMACH_AUTH_USERS` on a live server, or old clients will be rejected. Linked manufacturing reads are filtered by company/factory and traversed through PO lines, components, operations, inspections, payments, transport legs, material links and other saved relationships. Non-admin writes are checked against the same references; shared global masters are admin-write-only and exposed only when referenced by the scoped manufacturing graph. Generic legacy module records, global contacts/schedules/preferences, and WhatsApp bridge controls remain admin-only because their schemas do not yet provide reliable tenant ownership. The optional WhatsApp bridge continues to use its separate bridge credential; it is not authenticated by the AXIMACH bearer session. User accounts and company/factory assignments are configured server-side through `AXIMACH_AUTH_USERS`; there is not yet an in-app user/role administration screen. Sessions are held in server memory and are revoked at server restart; users must sign in again after a restart. Do not expose session tokens or bridge credentials to untrusted users.

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

Phone-number handling distinguishes real phone-number JIDs from internal `@lid` identities. LID/phone pairs from `messaging-history.set`, sender phone fields and alternate JIDs are used when available; if WhatsApp does not send a mapping for a historical LID, no phone number can be reliably inferred and AXIMACH leaves that field blank. The bridge persists the linked-device auth state and schedule/contact cache to disk and reconnects after temporary disconnects. The phone/app can be closed while this server remains running. If the server host sleeps, is shut down, loses its persistent volume, or WhatsApp logs the linked device out, schedules will not run until restored/reconnected. This bridge is based on an **unofficial WhatsApp Web protocol library**, not a WhatsApp/Meta-supported API; account restriction or breakage is possible. Use only with an account you control, respect WhatsApp rules, recipient consent, and rate limits. Contact sync is best-effort and depends on what WhatsApp sync events make available; it cannot guarantee every phone address-book entry is exposed. Do not send unsolicited or bulk messages.

This is an API/service integration commit, not yet a claim that a QR scanner UI, all-device record synchronization, delivery/reply webhooks, or production hosting has been completed or verified.


## Audit history

The service exposes the latest 10,000 server mutation events to administrators at `GET /api/audit-events`. The event payload intentionally omits business-field values, personal phone numbers and message bodies. Audit events persist in the same protected JSON database, are included in backups, and are carried forward across restores. This is an operational application audit trail, not a tamper-evident or legally immutable archive; retain encrypted off-host backups and add an independently controlled log sink before regulated production use.
