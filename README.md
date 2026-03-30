# Store Analytics Dashboard

Real-time analytics dashboard for [Amboras](https://amboras.com), a multi-tenant eCommerce platform. Track revenue, conversions, top products, and live visitor activity — all scoped to your store.

![Stack](https://img.shields.io/badge/NestJS-11-red?style=flat-square) ![Stack](https://img.shields.io/badge/Next.js-16-black?style=flat-square) ![Stack](https://img.shields.io/badge/PostgreSQL-16-blue?style=flat-square) ![Stack](https://img.shields.io/badge/Redis-7-red?style=flat-square) ![Stack](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square)

---

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16
- Redis 7

### 1. Start Infrastructure
```bash
docker compose up -d
```
This spins up PostgreSQL and Redis. Alternatively, point to your own instances.

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Update DATABASE_URL and REDIS_URL if needed
```

### 3. Seed Database
```bash
npm run seed
```
Seeds **100,000 events** across 2 demo stores with realistic distribution (takes ~10–15 seconds).

### 4. Start Backend
```bash
npm run start:dev
```
API available at `http://localhost:3001`

### 5. Frontend Setup
```bash
cd ../frontend
npm install
cp .env.example .env
npm run dev
```
Dashboard available at `http://localhost:3000`

### 6. Login
```
Email:    demo@techgadgets.com
Password: demo1234
```
Or use `demo@fashionhub.com` / `demo1234` for the second store.

---

## Docker (optional)

The included `docker-compose.yml` runs PostgreSQL 16 and Redis 7:

```yaml
docker compose up -d          # Start
docker compose down            # Stop
docker compose down -v         # Stop + delete data
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/login` | ✗ | Authenticate, returns JWT |
| `GET` | `/api/v1/analytics/overview` | ✓ | Revenue, events, conversion rate |
| `GET` | `/api/v1/analytics/top-products` | ✓ | Top products by revenue |
| `GET` | `/api/v1/analytics/revenue-by-day` | ✓ | Daily revenue breakdown |
| `GET` | `/api/v1/analytics/recent-activity` | ✓ | Last N events (real-time) |
| `POST` | `/api/v1/analytics/events` | ✗ | Ingest new event |

All analytics endpoints accept optional `?from=ISO_DATE&to=ISO_DATE` query params.

---

## Architecture Decisions

### Data Aggregation Strategy

**Decision:** Raw SQL aggregations with Redis caching (30–60s TTL)

**Why:** TypeORM's query builder generates N+1 queries and can't express window functions or complex GROUP BY efficiently. Raw parameterized SQL gives us full control. For a dashboard refreshed every 30 seconds by each user, exact real-time accuracy is not needed,30 second old data is perfectly acceptable and reduces DB load by ~95% during cache hit periods.

**Alternatives considered:**
- **Pre-aggregated materialized views:** Better for scale, but adds migration complexity and a refresh scheduler. Not worth it for MVP.
- **TimescaleDB hypertables:** Excellent for time-series, but adds an infrastructure dependency. Overkill here.
- **Application-level aggregation:** Never. Loading all rows and summing in JS would crash at 1M+ events.

**Trade-offs:** Slightly stale data (up to 30s) in exchange for sub-10ms response times on cache hits. Acceptable for a business analytics dashboard.

### Multi-Tenancy Security

**Decision:** `store_id` embedded in JWT payload, injected into every query at the service layer, never trusted from request params.

**Why:** The `store_id` is extracted from the verified JWT token by Passport.js. Even if a malicious user sends a different `store_id` in query params, the service ignores it and uses only the JWT-extracted value. This is defense-in-depth.

### Real-time Updates

**Decision:** WebSocket rooms per `store_id`, events emitted on write path.

**Why:** Polling every N seconds wastes bandwidth and adds latency. WebSocket rooms (`store:{store_id}`) mean each store's dashboard only receives its own events, no broadcasting everyone's data to everyone.

**Trade-offs:** Requires persistent connection. Falls back gracefully — dashboard still works without WS, just doesn't update in real-time.

### Frontend Data Fetching

**Decision:** SWR with 30s revalidation interval + WebSocket for live activity feed.

**Why:** SWR gives us caching, deduplication, and loading states for free. The 30s interval matches our Redis TTL so we're not hitting the backend more often than the cache refreshes. The WebSocket supplements SWR for the activity feed only, that's the one piece where near-real-time matters.

### Performance Optimizations

1. **Composite index** on `(store_id, timestamp DESC)` — covers nearly every query
2. **Partial index** on `(store_id, product_id) WHERE product_id IS NOT NULL` — top products query
3. **Redis caching** with per-endpoint TTLs (30s overview, 60s products/revenue)
4. **Bulk INSERT** in seed script (batches of 1,000)
5. **Raw SQL** for aggregations — avoids ORM overhead

---

## Known Limitations

- The `POST /events` endpoint has no auth — in production this would be an internal service-to-service call with a shared secret or mTLS
- Live visitor count is approximated (`page_view` events in last 5 min) — a real implementation would use Redis sorted sets with sliding window
- No pagination on recent activity beyond the 20-item limit
- Cache invalidation is coarse — we invalidate the whole overview cache on any new event, not just the affected time windows
- The seed script creates predictable data — real traffic would have much higher variance

---

## What I'd Improve With More Time

- **Materialized views** refreshed every 5 minutes for revenue aggregations
- **Redis sorted sets** for accurate live visitor counts (`ZADD` + `ZREMRANGEBYSCORE` pattern)
- **Event ingestion queue** (BullMQ) to decouple write path from analytics computation
- **Proper test suite** Jest unit tests for service, Supertest e2e for controllers
- **Rate limiting** on the public `POST /events` endpoint
- **Cursor-based pagination** for recent activity
- **Comparison metrics** (e.g. revenue this week vs last week, % change)
- **Export to CSV** functionality

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend Framework | NestJS | 11 |
| Frontend Framework | Next.js (App Router) | 16 |
| Language | TypeScript | 5.7 |
| Database | PostgreSQL | 16 |
| Cache | Redis | 7 |
| ORM | TypeORM | 0.3.20   |
| Real-time | Socket.IO | 4.7.5 |
| Auth | Passport.js + JWT | Latest |
| Styling | Tailwind CSS | 4.1.17 |
| Charts | Recharts | 2.12.6 |
| Data Fetching | SWR | 2.2.5 |

---

## Time Spent

~3.5 hours total:
- **30 min** — Architecture planning and schema design
- **60 min** — Backend (NestJS modules, auth, analytics service, WebSocket gateway)
- **45 min** — Seed script and database setup
- **60 min** — Frontend (Next.js dashboard, all components)
- **30 min** — README, polish, testing locally
- **15 min** — Video walkthrough prep 


## Video Walkthrough

[![Watch the walkthrough](https://img.shields.io/badge/YouTube-Watch%20Demo-FF0000?style=flat-square&logo=youtube)](https://youtu.be/QeVwuGEJv8I)
 