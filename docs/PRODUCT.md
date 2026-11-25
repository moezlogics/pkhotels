# PakHotels.pk — product plan

Hotel room reservations for Pakistan, built on the same platform as
propertydealer.pk and rentghar.pk (Next.js + NestJS + MongoDB).

## 1. What the big players do (research summary, Nov 2026)

| Company | Model | What we take from it |
| --- | --- | --- |
| **Booking.com** | 15–18% commission per stay, "pay at the property" on most rates, free cancellation as a filter, instant confirmation | Pay-at-hotel as the default, clear cancellation wording, "Only 2 rooms left" scarcity from real inventory, price shown for the whole stay |
| **Agoda** | Commission; strong in South/South-East Asia; mobile-first; "Book now, pay later" | Mobile booking in a few taps, sticky price bar, deals badges |
| **Airbnb** | Host + guest fees; trust through verified reviews and profiles | Reviews only from guests who actually stayed (we tie every review to a booking reference) |
| **Expedia / Vrbo** | Vrbo started as a **subscription** (pay a yearly fee, no commission) — moving to commission in 2026 | Proof that a subscription listing model works for owners who hate commission |
| **Tripadvisor Business Advantage** | Hotels pay a yearly subscription (from ~$99/yr) for a better listing, direct contact and booking links — no commission | Our paid plans: better placement, direct contact, branding — not per booking |
| **Trivago Business Studio+** | Hotels pay an annual subscription for visibility; Trivago itself earns per click | Paid plans buy visibility and tools, not bookings |
| **Lake.com** | Added a $499/yr membership with **zero commission** next to its 10% commission option | Hosts are switching to flat fees ("fee fatigue") — our core pitch |
| **OYO / Treebo / RedDoorz** | Budget-hotel aggregators in India/Indonesia: standardise small hotels, sell cheap rooms online | Small and mid hotels are the market; many have no website and run on WhatsApp |
| **Jovago (Pakistan, Rocket Internet)** | Pioneered online hotel booking in Pakistan; shut down | Commission + card payments did not fit Pakistan in time; a no-gateway model avoids that trap |

## 2. Pakistani problems we solve

1. **No payment gateway / low card use** → *Book now, pay at hotel.* No card needed. Optional
   **advance payment straight to the hotel** (its own bank account, JazzCash or Easypaisa);
   the guest uploads the screenshot, the hotel confirms. PakHotels never holds the money.
2. **Hotels hate 15–20% commission** → **0% commission.** Hotels pay a flat monthly plan
   (like propertydealer.pk packages). One booking's commission on Booking.com pays for a month.
3. **Fake bookings / no-shows** → mobile number required, booking reference, hotel can ask
   for an advance, hotels mark *No-show*, guests with repeated no-shows are flagged.
4. **Everything runs on WhatsApp** → every booking has a one-tap WhatsApp message to the hotel
   (and to the guest from the dashboard) with the reference and dates pre-filled.
5. **Couples / family policy, CNIC at check-in** → each hotel states it clearly: CNIC required,
   couples need nikah nama, family-only, unmarried couples allowed or not.
6. **Load-shedding, hot water, heating** → Pakistan-specific amenities: generator/UPS backup,
   geyser/hot water, room heater, prayer area, halal food, family hall, secure parking.
7. **Prices are not online** → room rates per night in PKR, taxes stated, extra mattress price,
   seasonal prices per date (Murree/Naran in summer, Eid rush).
8. **Owners are not technical** → the hotel dashboard is a phone-first list: *New requests →
   Confirm / Decline*, today's arrivals, rooms left per night.

## 3. Plans (one hotel per account — plans add benefits, not more hotels)

| | **Free** | **Standard** — Rs 3,999 / month | **Premium** — Rs 9,999 / month |
| --- | --- | --- | --- |
| Commission per booking | 0% | 0% | 0% |
| Hotels | 1 | 1 | 1 |
| Room types | 3 | 10 | Unlimited |
| Photos | 10 | 30 | 60 + video tour |
| Online booking requests / month | 15 | Unlimited | Unlimited |
| Guest phone & WhatsApp on booking | ✓ | ✓ | ✓ |
| Hotel's own phone/WhatsApp shown on listing | – | ✓ | ✓ |
| Advance payment to hotel's own accounts | – | ✓ | ✓ |
| Availability & price calendar (seasonal rates) | – | ✓ | ✓ |
| Instant confirmation | – | ✓ | ✓ |
| Listing goes live without review | – | ✓ | ✓ |
| Verified badge | – | ✓ | ✓ |
| Placement in city & search pages | Normal | Above Free | **Top + "Featured"** |
| Homepage featured hotels | – | – | ✓ |
| Deals / discount badge ("Hot deal") | – | – | ✓ |
| Booking & views insights | – | Basic | Full |
| Priority support / account manager | – | – | ✓ |

Yearly billing can be offered by adding packages with `duration: 365` from Dashboard →
Packages (suggested: Standard Rs 39,999/yr, Premium Rs 99,999/yr — two months free).
Payment for plans works exactly like propertydealer.pk: bank/JazzCash/Easypaisa transfer,
screenshot upload, admin approves.

**Imported hotels** (the 166 from the WordPress site) start *unclaimed*: bookings for them go
to the PakHotels admin, who calls the hotel (concierge mode). Owners use **Claim this hotel**
on the listing; after approval they manage it on the Free plan and can upgrade.

## 4. Booking flow

1. Guest picks city + dates + guests → search shows only hotels with rooms free on those nights,
   with the total for the stay.
2. Hotel page → choose room type and quantity → **Reserve** (sticky bar on mobile).
3. Checkout (one page): name, mobile (03xx), email optional, arrival time, special requests,
   stay purpose. Pay at hotel, or advance to the hotel's account if the hotel enables it.
4. Booking created as **Pending** (or **Confirmed** if the hotel's plan has instant confirmation).
   Reference like `PH-7K2M4Q` + private manage link (no account needed).
5. Hotel gets a push notification + the booking in Dashboard → Bookings, with WhatsApp/call buttons.
   Pending requests not answered within the hotel's response window expire automatically.
6. Statuses: `pending → confirmed → checked_in → completed`, or `declined`, `cancelled`
   (by guest or hotel), `no_show`, `expired`.
7. After check-out the guest can leave a **verified review** using the booking reference.

Inventory: each room type has a number of rooms. A night is available when
`rooms (or the calendar override) − rooms in pending/confirmed/checked-in bookings > 0`.
Hotels can close dates or set a different price per date.

## 5. URLs kept from the WordPress site (do not change)

| WordPress URL | New site |
| --- | --- |
| `/` | Home |
| `/hotels/` (+ `/hotels/page/N/`) | All hotels |
| `/hotels/<slug>/` | Hotel page (same slug) |
| `/hotel-location/<city>/` (+ `/page/N/`) | Hotels in a city |
| `/my-account/` | Guest account: my bookings |
| `/tf-wishlist/` | Saved hotels |
| `/tf-qr-code-scanner/` | Find / verify a booking by reference |
| `/blog/` | Blog |
| `/login/`, `/register/`, `/dashboard/` | Same purpose |
| `/search/`, `/hotel-search/` | Search results |
| `/tf_room/<slug>/` | 301 → its hotel page, rooms section |
| `/cart/`, `/checkout/` | 301 → `/hotels/` |
| `/wp-content/uploads/...` | Same image files, served from `uploads/wp/` |

The whole site uses trailing slashes, like WordPress did.
