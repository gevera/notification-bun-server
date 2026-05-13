# Micro SaaS: Website Notification Relay

## Problem

Businesses with static websites need notifications when users make requests. Previously solved with Express + Telegram SDK. Telegram, WhatsApp, and Discord are banned in Russia. No third-party services that are blocked in Russia (no Cloudflare).

## Solution: RSS Feeds

Each registered site gets a private RSS feed. Business owners subscribe in any RSS reader on any device. Email is unreliable (gets lost). Real-time dashboards are overengineered. RSS is standard, ubiquitous, and can't be banned.

## Routes

### `POST /register` — Register a new website

Authenticated with the admin secret key. Creates a new project for a domain.

**Request:**
```json
{
  "secret": "<ADMIN_SECRET>",
  "domain": "example.com"
}
```

**Response:**
```json
{
  "uuid": "a7f3b2c1-e4d5-...",
  "feedUrl": "https://yourservice.com/feed/a7f3b2c1-e4d5-...",
  "verifyToken": "abc123def456..."
}
```

- `uuid` — unique project identifier
- `feedUrl` — RSS feed URL for this project (subscribe in any RSS reader)
- `verifyToken` — value to place in `/.well-known/verify.txt` on the domain to prove ownership

### `POST /notify` — Send a notification

Called from static websites (client-side JS). Validates Origin header against registered + verified domains, checks rate limit, appends to RSS feed.

### `GET /feed/:uuid` — RSS feed

Serves RSS XML for a project. UUID is unguessable — possession of the URL = access (same as Google Calendar private calendars). Revoke = regenerate UUID.

## Authentication

### Admin Auth (registration)

A secret key stored in the `ADMIN_SECRET` env variable. Required to register new websites via `POST /register`. Only the service owner knows this.

### Domain Verification

After registration, the business owner places the returned `verifyToken` at:

```
theirsite.com/.well-known/verify.txt
```

Server verifies the file exists and contains the correct token. Domain is then marked as verified and `POST /notify` requests from that Origin are accepted.

No DNS records involved — file-based verification only.

### Request Auth (static sites, no secrets)

1. Domain must be registered and verified
2. Browser sends `Origin` header automatically — can't be forged client-side
3. Server checks Origin matches a verified domain
4. Rate limiting per domain (100 req/hour)

## Architecture

```
[Service Owner]
    |
    | POST /register (secret + domain)
    v
[Elysia/Bun Server]
    |
    | returns uuid, feedUrl, verifyToken
    v
[Service Owner] ---> sends verifyToken to business owner
                          |
                          | places verifyToken in /.well-known/verify.txt
                          v
                   [Static Website]

---

[Static Website]
    |
    | form submit (browser, Origin header)
    v
[Elysia/Bun Server]
    |
    | 1. check Origin against verified domains
    | 2. check rate limit
    | 3. append to RSS feed (SQLite)
    v
[SQLite] --> RSS XML (GET /feed/:uuid)
                    |
                    v
            [Business owner's RSS reader]
```

## Stack

- **Bun** — runtime
- **Elysia** — web framework (Bun-native, type-safe, performant)
- **SQLite** — persistence for notifications + registered domains
- **No frontend** — MVP is just the API + RSS feed URLs

## Database Schema (SQLite)

```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL UNIQUE,
  verify_token TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Implementation Notes

- The JS snippet for static sites: small form handler that POSTs to the server with the message payload
- RSS feed returns last N notifications in standard XML format
- `ADMIN_SECRET` loaded from env variable (`.env` file or system env)
- Optional future: email digest, VK Bot relay, web dashboard as paid tier
