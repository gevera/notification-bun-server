# notification-bun-server

Lightweight notification relay service. Websites send JSON payloads → you get notifications via RSS feed.

## Setup

```bash
bun install
ADMIN_SECRET=your-secret bun run src/index.ts
```

Environment variables:

| Variable | Default | Description |
|---|---|---|
| `ADMIN_SECRET` | required | Secret for admin endpoints |
| `PORT` | `3000` | Server port |
| `BASE_URL` | `http://localhost:3000` | Public URL (used for RSS feed links) |
| `DB_PATH` | `./notifications.db` | SQLite database path |

## Usage

### 1. Register a project

```bash
curl -X POST http://localhost:3000/register \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com"}'
```

Response:
```json
{
  "uuid": "abc123...",
  "verify_token": "token...",
  "feed_url": "http://localhost:3000/feed/abc123..."
}
```

### 2. Verify domain

Add the `verify_token` as a TXT record or place it at `http://example.com/.well-known/notification-verify.txt`, then:

```bash
curl -X POST http://localhost:3000/verify/abc123... \
  -H "Authorization: Bearer YOUR_SECRET"
```

### 3. Send notifications

```bash
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -d '{
    "uuid": "abc123...",
    "payload": {
      "name": "Denis",
      "telephone": "+7 (435) 983-40-59",
      "message": "Гостей: 1; Дата прибытия: 2027-03-03",
      "time": "5/13/2026, 9:04:27 PM",
      "group": "eurasia-book"
    }
  }'
```

### 4. Read the RSS feed

Subscribe to the `feed_url` from step 1 in any RSS reader.

### 5. Customize notification format (optional)

By default, notifications render in Russian with a booking-style template. You can customize per project:

```bash
curl -X PUT http://localhost:3000/format/abc123... \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "title_template": "Новая заявка от \"{name}\"",
    "fields": [
      { "key": "telephone", "label": "Телефон" },
      { "key": "message", "label": "Сообщение" }
    ]
  }'
```

`title_template` supports `{fieldName}` placeholders from your payload. `fields` controls which payload fields appear in the RSS item description and their labels. The `time` field is auto-formatted to `HH:MM DD/MM/YYYY`.
