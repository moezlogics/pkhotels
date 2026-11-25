# PakHotels (pakhotels.pk)

Pakistan's hotel booking site. Guests reserve rooms online and **pay at the hotel**
(or send an advance straight to the hotel's own account). Hotels pay **no commission** —
they list free or on a flat monthly plan, the same model as propertydealer.pk.

Product plan, research, plans and the URL map: [docs/PRODUCT.md](docs/PRODUCT.md).

A Turborepo monorepo (same platform as propertydealer.pk / rentghar.pk):

| Path | What |
| --- | --- |
| `apps/web` | Next.js 16 site + dashboard (`/dashboard`) |
| `apps/api` | NestJS + Mongoose API (mounted under `/api`) |
| `apps/api/src/hotel` | Hotels, rooms, rate calendar, availability, bookings, reviews, claims |
| `packages/db` | Shared Mongoose schemas (`hotel`, `room`, `room-rate`, `booking`, `hotel-review`, `hotel-claim`, …) |
| `scripts/import-wordpress.js` | Brings the WordPress (Tourfic) hotels, rooms and photos over |

## Run it locally

Needs Node 20+ and a local MongoDB.

```bash
npm install
npm run seed:local                 # local admin + cities/areas (refuses non-local DBs)
npm run export:wp                  # optional: fresh export from the live WordPress site
npm run import:wp                  # 166 hotels, rooms, cities + photos into uploads/wp
NODE_OPTIONS=--max-old-space-size=6144 npm run build   # always from the root
npm run start --workspace=apps/api                     # API on http://localhost:3205
npm run start --workspace=apps/web -- -p 3200          # site on http://localhost:3200
```

Dev mode: `npm run dev` (API 3205 with watch, web 3200). Then sign in as the local admin
(`scripts/seed-local.js` → `LOCAL_ADMIN`) and create the three plans with
`POST /api/packages/seed` (Dashboard session) — they are matched by name, so running it again
just updates them.

## How booking works

- `GET /api/hotels?city=&checkIn=&checkOut=&adults=` — search; with dates only hotels with rooms
  free on every night are returned, priced for the stay.
- `GET /api/hotels/slug/:slug/quote` — rooms left and prices for a stay.
- `POST /api/bookings` — a reservation (no account needed). Returns a reference (`PH-XXXXXX`) and a
  secret for the guest's manage page `/booking/<ref>/?t=<secret>`.
- Hotels confirm/decline in Dashboard → Bookings; unanswered requests expire after the hotel's
  response window; stays are completed automatically after check-out, which opens the review form.
- Availability = rooms of the type (or the calendar override) − rooms held by pending, confirmed
  and checked-in bookings on that night.

Imported hotels have no owner ("unclaimed"): bookings go to the admin (concierge), and owners
claim them from the hotel page (Dashboard → Hotel Claims).

## URLs kept from WordPress

`/`, `/hotels/`, `/hotels/<slug>/`, `/hotel-location/<city>/`, `/hotels/page/N/`, `/my-account/`,
`/tf-wishlist/`, `/tf-qr-code-scanner/`, `/blog/`, `/search/`, `/hotel-search/`; `/tf_room/<slug>/`
redirects to its hotel; `/wp-content/uploads/...` serves the same photos; Yoast sitemap names
(`/sitemap_index.xml`, `/tf_hotel-sitemap.xml`, …) still answer. Trailing slashes everywhere, as before.
**Never change a hotel's slug once it is live.**

## Configuration

- `apps/api/.env` — see `apps/api/.env.example` (local: `MONGODB_URI=mongodb://localhost:27017/pakhotels`, `PORT=3205`).
- `apps/web/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:3205`, `NEXT_PUBLIC_BASE_URL=http://localhost:3200`.
- `apps/web/.env.production` — public production values (`https://pakhotels.pk`).

Production (PM2): `ecosystem.config.js` runs the website on 3119 and the API on 3120 (127.0.0.1 only) — see DEPLOY.md.
