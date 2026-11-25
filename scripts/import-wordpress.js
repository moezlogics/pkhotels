/*
 * PakHotels — bring the WordPress (Tourfic) hotels into MongoDB.
 *
 *   python scripts/wp-dump.py data/wp-export        # 1. export from the live WordPress site
 *   npm run import:wp                               # 2. hotels, rooms, cities (+ images)
 *   npm run import:wp -- --no-images                #    skip downloading photos
 *
 * What it keeps, because Google ranks it:
 *   - every hotel's slug  → /hotels/<slug>/ stays the same address
 *   - Yoast SEO title and description
 *   - the city pages     → /hotel-location/<city>/
 *   - photo paths        → files land in uploads/wp/<yyyy>/<mm>/<name>, and
 *                          /wp-content/uploads/... is rewritten to them (next.config.ts)
 *   - room pages         → /tf_room/<slug>/ redirects to the hotel (Room.wpSlug)
 *
 * Imported hotels are "unclaimed": no owner, bookings go to the admin, and the
 * owner can claim the listing from its page. Safe to run again: everything is
 * matched on the WordPress id and updated in place (owner, status and anything
 * changed in the dashboard since are left alone unless --overwrite is given).
 * Refuses non-local databases.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { MongoClient } = require('mongodb');

const ROOT = path.join(__dirname, '..');
const DUMP = path.join(ROOT, 'data', 'wp-export', 'pakhotels-wp.json');
const UPLOADS = path.join(ROOT, 'uploads', 'wp');
const args = new Set(process.argv.slice(2));
const WITH_IMAGES = !args.has('--no-images');
const OVERWRITE = args.has('--overwrite');

function readEnvUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const file = path.join(ROOT, 'apps', 'api', '.env');
  const line = fs.existsSync(file) && fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('MONGODB_URI='));
  return line ? line.slice('MONGODB_URI='.length).trim() : '';
}
const uri = readEnvUri();
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/[\w-]+$/.test(uri) && !args.has('--allow-remote')) {
  console.error('Refusing: MONGODB_URI must be a local database. Import locally, then move the data with db:export / import-live.');
  process.exit(1);
}
if (!fs.existsSync(DUMP)) {
  console.error(`No export at ${DUMP}. Run: python scripts/wp-dump.py data/wp-export`);
  process.exit(1);
}

/* ── helpers ── */

const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const decode = (s) =>
  String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/�/g, '•');
const stripTags = (h) => decode(String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
/** Cleans WordPress block HTML: drops data-* attributes and classes, keeps structure. */
const cleanHtml = (h) =>
  decode(String(h || ''))
    .replace(/\s(data-[\w-]+|class|id|style)="[^"]*"/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/https?:\/\/(www\.)?pakhotels\.pk\/wp-content\/uploads\//g, '/uploads/wp/')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
const localUrl = (u) => {
  const m = String(u || '').match(/\/wp-content\/uploads\/(.+)$/);
  return m ? `/uploads/wp/${m[1]}` : '';
};
const asObj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const list = (v) => (Array.isArray(v) ? v : Object.values(asObj(v)));

/** WordPress feature names → PakHotels amenity keys (apps/web/lib/hotel-amenities.ts). */
const FEATURE_MAP = [
  [/wi-?fi|internet/i, 'wifi'],
  [/parking/i, 'parking'],
  [/air ?condition/i, 'ac'],
  [/breakfast/i, 'breakfast'],
  [/restaurant|snack bar|dining/i, 'restaurant'],
  [/room service/i, 'room_service'],
  [/24-hour security|cctv|security/i, 'security_24'],
  [/elevator|lift/i, 'elevator'],
  [/family room/i, 'family_rooms'],
  [/non-smoking/i, 'non_smoking'],
  [/fitness|gym/i, 'gym'],
  [/swimming pool|pool/i, 'pool'],
  [/flat-screen|tv\b|television/i, 'tv'],
  [/minibar/i, 'minibar'],
  [/tea\/coffee|kettle/i, 'kettle'],
  [/toiletries|slippers|towels/i, 'toiletries'],
  [/private bathroom/i, 'private_bathroom'],
  [/bathtub|hot tub/i, 'bathtub'],
  [/wardrobe|closet|clothes rack/i, 'wardrobe'],
  [/car rental/i, 'car_rental'],
  [/tour desk|concierge|guide/i, 'tour_desk'],
  [/meeting|banquet|conference/i, 'meeting_rooms'],
  [/garden|terrace|picnic|outdoor furniture/i, 'garden'],
  [/bbq|barbecue/i, 'bbq'],
  [/fireplace|bonfire/i, 'bonfire'],
  [/fire extinguisher/i, 'fire_safety'],
  [/fax|photocopy|business centre/i, 'business_centre'],
  [/tennis|badminton/i, 'sports'],
  [/kid/i, 'kids_friendly'],
  [/airport (shuttle|pick)/i, 'airport_shuttle'],
  [/laundry|dry clean/i, 'laundry'],
  [/front desk/i, 'front_desk_24'],
  [/generator|ups|power backup/i, 'generator'],
  [/heater|heating/i, 'heating'],
  [/prayer|mosque/i, 'prayer_area'],
  [/halal/i, 'halal'],
  [/spa|massage|sauna/i, 'spa'],
  [/wheelchair|accessible/i, 'wheelchair'],
];
function amenitiesFrom(...texts) {
  const out = new Set();
  for (const t of texts) for (const [rx, key] of FEATURE_MAP) if (rx.test(t)) out.add(key);
  return [...out];
}

function timeFrom(text, which) {
  const rx = which === 'in' ? /check[- ]?in[^.]{0,60}?(\d{1,2})(?::(\d{2}))?\s*(am|pm|hours)?/i : /check[- ]?out[^.]{0,60}?(\d{1,2})(?::(\d{2}))?\s*(am|pm|hours)?/i;
  const m = String(text || '').match(rx);
  if (!m) return which === 'in' ? '14:00' : '12:00';
  let h = Number(m[1]);
  const mm = m[2] || '00';
  if (/pm/i.test(m[3] || '') && h < 12) h += 12;
  if (/am/i.test(m[3] || '') && h === 12) h = 0;
  if (h > 23) return which === 'in' ? '14:00' : '12:00';
  return `${String(h).padStart(2, '0')}:${mm}`;
}

function validLatLng(lat, lng) {
  const a = Number(lat), b = Number(lng);
  return a > 23 && a < 37.5 && b > 60 && b < 78 ? { lat: a, lng: b } : {};
}

function download(url, dest) {
  return new Promise((resolve) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return resolve('skip');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (pakhotels migration)' }, timeout: 60_000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve('fail ' + res.statusCode);
      }
      const tmp = dest + '.part';
      const out = fs.createWriteStream(tmp);
      res.pipe(out);
      out.on('finish', () => out.close(() => { fs.renameSync(tmp, dest); resolve('ok'); }));
      out.on('error', () => resolve('fail write'));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve('fail net'));
  });
}

async function pool(items, n, fn) {
  let i = 0, done = 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
      if (++done % 100 === 0) console.log(`  images ${done}/${items.length}`);
    }
  });
  await Promise.all(workers);
}

const CITY_STATE = { Islamabad: 'Islamabad Capital Territory', Lahore: 'Punjab', Karachi: 'Sindh', Multan: 'Punjab' };

(async () => {
  const wp = JSON.parse(fs.readFileSync(DUMP, 'utf8'));
  const media = new Map(wp.media.map((m) => [m.id, m]));
  const mediaUrl = (id) => localUrl(media.get(Number(id))?.source_url);
  const features = new Map(wp.hotel_feature.map((t) => [t.id, decode(t.name)]));
  const locations = new Map(wp.hotel_location.map((t) => [t.id, decode(t.name)]));

  const client = await MongoClient.connect(uri);
  const db = client.db();
  const now = new Date();

  /* cities */
  const cityIds = new Map();
  for (const name of new Set(locations.values())) {
    const existing = await db.collection('cities').findOne({ name: new RegExp(`^${name}$`, 'i') });
    let id = existing?._id;
    // City meta is left empty on purpose: the site builds it from live data (hotel count, lowest price).
    if (!id) {
      id = (await db.collection('cities').insertOne({
        name, state: (CITY_STATE[name] || '').toLowerCase(), country: 'pakistan',
        createdAt: now, updatedAt: now,
      })).insertedId;
    }
    cityIds.set(name, id);
  }
  console.log('cities:', [...cityIds.keys()].join(', '));

  /* hotels */
  const roomsByHotel = new Map();
  for (const r of wp.rooms) {
    const hid = Number(asObj(r.tf_room_opt).tf_hotel);
    if (!roomsByHotel.has(hid)) roomsByHotel.set(hid, []);
    roomsByHotel.get(hid).push(r);
  }

  const wanted = new Set();
  let made = 0, updated = 0, roomCount = 0;
  for (const h of wp.hotels) {
    const o = asObj(h.tf_hotels_opt);
    const cityName = locations.get((h.hotel_location || [])[0]) || 'Lahore';
    const map = asObj(o.map);
    const yo = asObj(h.yoast_head_json);
    const desc = cleanHtml(h.content?.rendered);
    const featureNames = [
      ...(h.hotel_feature || []).map((id) => features.get(id) || ''),
      ...list(o['hotel-facilities']).map((f) => features.get(Number(f['facilities-feature'])) || ''),
    ];
    const allText = stripTags(desc) + ' ' + stripTags(o.tc);
    const amenities = amenitiesFrom(...featureNames, allText);
    const coverUrl = localUrl(h.featured_image) || mediaUrl(h.featured_media);
    const gallery = String(o.gallery || '').split(',').map((x) => mediaUrl(x.trim())).filter(Boolean).filter((u) => u !== coverUrl);
    const faqs = list(o.faq).filter((f) => f && f.title).map((f) => ({ q: stripTags(f.title), a: stripTags(f.description) }));
    const faqText = faqs.map((f) => f.a).join(' ') + ' ' + stripTags(o.tc);

    const doc = {
      name: decode(h.title?.rendered).trim(),
      propertyType: /guest ?house/i.test(h.title?.rendered) ? 'guest_house' : /resort/i.test(h.title?.rendered) ? 'resort' : /apartment|suite/i.test(h.title?.rendered) ? 'apartment' : 'hotel',
      stars: 0,
      shortDescription: decode(yo.description || stripTags(desc).split('\n')[0] || '').slice(0, 300),
      description: desc,
      city: cityIds.get(cityName),
      citySlug: slugify(cityName),
      cityName,
      areaName: '',
      address: decode(map.address || ''),
      ...validLatLng(map.latitude, map.longitude),
      nearby: list(o['nearby-places']).filter((p) => p && p['place-title']).map((p) => ({ title: decode(p['place-title']).trim(), distance: decode(p['place-dist'] || '').trim() })),
      coverImage: coverUrl,
      gallery,
      amenities,
      checkInTime: timeFrom(faqText, 'in'),
      checkOutTime: timeFrom(faqText, 'out'),
      policies: cleanHtml(o.tc),
      faqs,
      // Imported hotels take pay-at-hotel bookings with no advance, so cancelling costs the guest nothing.
      cancellationPolicy: 'free',
      metaTitle: decode(yo.title || ''),
      metaDescription: decode(yo.description || ''),
      source: 'wordpress',
      wpId: h.id,
    };

    const existing = await db.collection('hotels').findOne({ wpId: h.id });
    let hotelId;
    if (existing) {
      hotelId = existing._id;
      const set = OVERWRITE ? doc : Object.fromEntries(Object.entries(doc).filter(([k]) => existing[k] === undefined || existing[k] === '' || (Array.isArray(existing[k]) && !existing[k].length)));
      if (Object.keys(set).length) await db.collection('hotels').updateOne({ _id: hotelId }, { $set: { ...set, updatedAt: now } });
      updated++;
    } else {
      // The slug is the ranked address: keep it exactly.
      hotelId = (await db.collection('hotels').insertOne({
        ...doc,
        slug: h.slug,
        status: 'approved',
        idRequired: true,
        couplePolicy: 'couples_with_nikah',
        childrenAllowed: true, petsAllowed: false, smokingAllowed: false,
        freeCancelHours: 24, taxIncluded: true, taxPercent: 0, extraBedPrice: 0,
        phone: '', whatsapp: '', email: '', website: '',
        acceptsBookings: true, instantConfirm: false, responseHours: 12, advanceMode: 'none', advancePercent: 25, paymentAccounts: [],
        featured: false, verified: false, dealText: '', dealPercent: 0, rank: 0,
        minPrice: 0, roomTypes: 0, ratingAvg: 0, ratingCount: 0, views: 0, bookingsCount: 0,
        createdAt: new Date(h.date_gmt + 'Z'), updatedAt: now,
      })).insertedId;
      made++;
    }

    /* rooms */
    let sort = 0;
    for (const r of roomsByHotel.get(h.id) || []) {
      const ro = asObj(r.tf_room_opt);
      const price = Number(ro.price) || Number(ro.adult_price) || 0;
      if (!(price > 0)) continue;
      const html = cleanHtml(r.content?.rendered);
      const firstLine = stripTags(html).split('\n').map((s) => s.trim()).find(Boolean) || '';
      const bedType = /bed/i.test(firstLine) && firstLine.length < 80 ? firstLine : '';
      const footage = String(ro.footage || '');
      const sqm = /m/i.test(footage) && !/ft/i.test(footage);
      const size = Math.round((parseFloat(footage) || 0) * (sqm ? 10.764 : 1));
      const room = {
        hotel: hotelId,
        name: decode(r.title?.rendered).trim(),
        description: stripTags(html).replace(bedType, '').trim().slice(0, 2000),
        bedType,
        beds: Number(ro.bed) || 1,
        maxAdults: Math.max(1, Number(ro.adult) || 2),
        maxChildren: Number(ro.child) || 0,
        size,
        price,
        weekendPrice: 0,
        originalPrice: ro.discount_hotel_type === 'percent' && Number(ro.discount_hotel_price) > 0 ? price : 0,
        quantity: Number(ro['num-room']) > 0 ? Number(ro['num-room']) : 5,
        breakfastIncluded: /breakfast (is )?included|with breakfast/i.test(html),
        refundable: true,
        amenities: amenitiesFrom(stripTags(html)),
        images: String(ro.gallery || '').split(',').map((x) => mediaUrl(x.trim())).filter(Boolean),
        minNights: Math.max(1, Number(ro.minimum_stay_requirement) || 1),
        isActive: ro.enable !== '0',
        sort: sort++,
        wpSlug: r.slug,
        wpId: r.id,
      };
      const ex = await db.collection('rooms').findOne({ wpId: r.id });
      if (ex) {
        if (OVERWRITE) await db.collection('rooms').updateOne({ _id: ex._id }, { $set: { ...room, updatedAt: now } });
      } else {
        await db.collection('rooms').insertOne({ ...room, createdAt: now, updatedAt: now });
      }
      roomCount++;
    }
    const prices = (await db.collection('rooms').find({ hotel: hotelId, isActive: true }, { projection: { price: 1 } }).toArray()).map((r) => r.price).filter((p) => p > 0);
    await db.collection('hotels').updateOne({ _id: hotelId }, { $set: { minPrice: prices.length ? Math.min(...prices) : 0, roomTypes: prices.length } });

    for (const u of [coverUrl, ...gallery]) if (u) wanted.add(u);
    for (const r of roomsByHotel.get(h.id) || []) for (const x of String(asObj(r.tf_room_opt).gallery || '').split(',')) { const u = mediaUrl(x.trim()); if (u) wanted.add(u); }
    for (const m of desc.matchAll(/\/uploads\/wp\/[^"'\s)]+/g)) wanted.add(m[0]);
  }
  await db.collection('hotels').createIndex({ slug: 1 }, { unique: true });
  console.log(`hotels: ${made} new, ${updated} already there · rooms: ${roomCount}`);

  if (WITH_IMAGES) {
    const jobs = [...wanted].map((u) => ({ url: 'https://pakhotels.pk/wp-content/uploads/' + u.slice('/uploads/wp/'.length), dest: path.join(UPLOADS, ...u.slice('/uploads/wp/'.length).split('/')) }));
    console.log(`downloading ${jobs.length} photos to uploads/wp (already-downloaded files are skipped)…`);
    let failed = 0;
    await pool(jobs, 8, async (j) => { const r = await download(j.url, j.dest); if (r.startsWith('fail')) failed++; });
    console.log(`photos done${failed ? `, ${failed} failed (run again to retry)` : ''}`);
  }
  await client.close();
  console.log('Done. Unclaimed hotels get their plan perks within a few minutes of the API starting.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
