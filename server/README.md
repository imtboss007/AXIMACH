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
