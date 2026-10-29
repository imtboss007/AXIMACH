# AXIMACH Scheduler Service

This optional Node.js service runs scheduled WhatsApp **individual** messages independently of the AXIMACH UI, as long as this service is deployed on an always-on host with persistent storage.

## Required environment variables

- `AXIMACH_API_KEY`: strong random secret used by the UI/API caller.
- `WHATSAPP_ACCESS_TOKEN`: Meta WhatsApp Cloud API access token.
- `WHATSAPP_PHONE_NUMBER_ID`: phone-number ID from the Meta WhatsApp Business platform.
- `AXIMACH_DATA_FILE`: persistent file path, e.g. `/data/aximach.json` on a host with a persistent disk.
- `AXIMACH_ALLOWED_ORIGIN`: exact origin allowed to call this API.
- `PORT`: optional; defaults to 8787.
- `WHATSAPP_GRAPH_VERSION`: optional Graph API version; defaults to v23.0.

Run with Node.js 20.18+: `node server/index.mjs`.

## API

All routes except `GET /health` require header `x-aximach-key: <AXIMACH_API_KEY>`.

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
  -e AXIMACH_ALLOWED_ORIGIN='https://your-aximach-app.example.com' \
  -e WHATSAPP_ACCESS_TOKEN='set-through-host-secrets' \
  -e WHATSAPP_PHONE_NUMBER_ID='set-through-host-secrets' \
  -v aximach-data:/data aximach-scheduler
```

Use your host's secret manager instead of putting real credentials in shell history. The volume must be persistent and backups should be configured. Put the service behind HTTPS.

## Frontend connection and security

The Communication & Follow-up screen can connect to this API, add contacts with explicit opt-in, create one-time/daily/weekly individual schedules, pause/resume schedules, refresh records and export contacts as CSV. The API key is held in browser session storage for the active tab session. This is a connector prototype, **not a multi-user security boundary**: anyone allowed to use the UI can potentially inspect/use that key. Do not expose this configuration to untrusted users or deploy it publicly without adding real user authentication, per-user authorization and a server-side session/proxy.

The current scheduler does not sync a phone's WhatsApp address book, pair via QR/linked devices, send to WhatsApp groups, or stop repeated messages on a reply. Those require supported provider capabilities and additional webhook/state handling. Do not configure repeat messages without appropriate recipient consent and a clear stop/pause process.
