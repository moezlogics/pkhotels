#!/usr/bin/env node
/*
 * PakHotels — fills the SEO text for every rental archive page in the database:
 *
 *   /properties/rent/<city>                  city title, description, intro   (city.rent*)
 *   /properties/rent/<city>/<type>           "Houses for Rent in Faisalabad"  (city.typeContents)
 *   /properties/rent/<city>/<area>           "… for Rent in DHA Phase 5, Lahore" (area.rent*)
 *
 *   node scripts/db/seo-fill.js              fill only what is empty (safe, run any time)
 *   node scripts/db/seo-fill.js --dry-run    show what would change, change nothing
 *   node scripts/db/seo-fill.js --overwrite  rewrite every generated field, even ones already set
 *
 * - Reads MONGODB_URI from apps/api/.env (the same database the API uses), so the
 *   same command works on your PC and on the live server.
 * - Without --overwrite it never touches a field that already has text, so
 *   anything typed in the dashboard (Cities / Areas → SEO) is kept.
 * - Run it again after adding cities or areas: only the new ones are filled.
 * - The website also builds these titles itself when a field is empty; the
 *   database copy is what you see and edit in the dashboard.
 * After running it on the live site:  pm2 restart pakhotels-api pakhotels-web
 */
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const ROOT = path.join(__dirname, '..', '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const OVERWRITE = args.includes('--overwrite');

function readEnvUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  // Local development values live in .env.local; .env holds the live server's.
  const file = [path.join(ROOT, 'apps', 'api', '.env').replace(/\.env$/, '.env.local'), path.join(ROOT, 'apps', 'api', '.env')].find((f) => fs.existsSync(f));
  const line = fs.existsSync(file) && fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('MONGODB_URI='));
  return line ? line.slice('MONGODB_URI='.length).trim() : '';
}

// ── Names ───────────────────────────────────────────────────────────────────

const ACRONYMS = new Set(['dha', 'lda', 'eme', 'paf', 'cda', 'mda', 'fda', 'ruda', 'wapda', 'pcsir', 'nfc', 'ptcl', 'bzu', 'cbd', 'pia', 'gor', 'pechs', 'kda', 'ecc', 'pwd', 'opf', 'nespak']);
const title = (s) =>
  String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((w) => (ACRONYMS.has(w.replace(/[^a-z]/g, '')) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

const BRAND = 'PakHotels';
const listOf = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const clip = (s, n = 158) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/[\s,;:—-]+\S*$/, '')}…`);

// ── Rental types ────────────────────────────────────────────────────────────
// plural: page heading word · who: who rents it · what: one line about it · check: what to look at.

const TYPES = {
  house: {
    plural: 'Houses',
    who: 'families',
    what: 'whole houses from 3 and 5 marla to 10 marla and 1 kanal, furnished and unfurnished',
    check: 'the number of bedrooms, gas and water supply, parking and how far it is from schools and markets',
  },
  'upper-portion': {
    plural: 'Upper Portions',
    who: 'small families and couples',
    what: 'upper floors with their own entrance, kitchen and bathrooms, while the owner or another tenant lives below',
    check: 'whether the stairs and gate are separate, the electricity and gas meters, and roof access',
  },
  'lower-portion': {
    plural: 'Lower Portions',
    who: 'families who want the ground floor',
    what: 'ground floors with their own entrance, often with the lawn and car porch',
    check: 'a separate meter, parking space, and whether the upper floor is rented out',
  },
  flat: {
    plural: 'Flats',
    who: 'working people, students and small families',
    what: 'flats in buildings and plazas, from one-bed units to family flats with lifts and backup power',
    check: 'the floor, lift and generator backup, maintenance charges and parking',
  },
  apartment: {
    plural: 'Apartments',
    who: 'professionals and families',
    what: 'apartments in managed buildings and towers, many with security, lifts and backup power',
    check: 'monthly maintenance, security, parking and whether utilities are included',
  },
  room: {
    plural: 'Rooms',
    who: 'students, bachelors and working people',
    what: 'single and shared rooms in houses and flats, some with meals, internet and bills included',
    check: 'whether bills are included, the kitchen and bathroom arrangement, and house rules',
  },
  hostel: {
    plural: 'Hostels',
    who: 'students and working men and women',
    what: 'boys and girls hostels near universities, colleges and offices, with meals, internet and laundry',
    check: 'meals, security, internet, room sharing and the advance and monthly fee',
  },
  shop: {
    plural: 'Shops',
    who: 'shopkeepers and businesses',
    what: 'shops on main roads, in markets and plazas, from small kiosks to showrooms',
    check: 'footfall, frontage, the electricity load, and the advance and yearly rent increase',
  },
  office: {
    plural: 'Offices',
    who: 'companies, startups and professionals',
    what: 'office floors, suites and shared offices in commercial areas and plazas',
    check: 'parking, lifts, backup power, internet and the lease length',
  },
  warehouse: {
    plural: 'Warehouses',
    who: 'traders, factories and distributors',
    what: 'warehouses, godowns and storage spaces with truck access',
    check: 'covered area, height, road access for trucks, security and the electricity load',
  },
  commercial: {
    plural: 'Commercial Spaces',
    who: 'businesses of every size',
    what: 'commercial buildings, halls and floors for shops, clinics, schools and offices',
    check: 'the location, frontage, parking and the approved use of the building',
  },
};

// ── Text builders ───────────────────────────────────────────────────────────

function cityText(city, areas) {
  const c = title(city.name);
  const where = areas.length ? ` in areas such as ${listOf(areas.slice(0, 5))}` : '';
  return {
    rentMetaTitle: `Houses, Portions, Flats & Rooms for Rent in ${c} | ${BRAND}`,
    rentMetaDescription: clip(`Houses, upper and lower portions, flats, rooms, shops and offices for rent in ${c}. Compare monthly rents by area and size and contact owners directly on ${BRAND}.`),
    rentContent:
      `<p>Looking for a place to rent in ${c}? ${BRAND} lists houses, upper and lower portions, flats, rooms, hostels, shops and offices for rent across the city${where}.</p>` +
      `<p>Every listing shows the monthly rent, size and photos. Filter by area, property type, size and budget, then call or WhatsApp the owner or dealer straight from the listing — no sign-up needed.</p>`,
  };
}

function cityTypeText(city, slug, areas) {
  const t = TYPES[slug];
  const c = title(city.name);
  const where = areas.length ? ` Popular areas for ${t.plural.toLowerCase()} include ${listOf(areas.slice(0, 5))}.` : '';
  return {
    metaTitle: `${t.plural} for Rent in ${c} | ${BRAND}`,
    metaDescription: clip(`${t.plural} for rent in ${c}: compare monthly rents by area and size, see real photos and call or WhatsApp owners and dealers directly on ${BRAND}.`),
    content:
      `<p>Find ${t.plural.toLowerCase()} for rent in ${c} on ${BRAND} — ${t.what}. They suit ${t.who}.${where}</p>` +
      `<p>Each listing shows the monthly rent up front. Before you visit, check ${t.check}. Contact the owner or dealer directly from the listing and agree the terms in writing before paying any advance.</p>`,
  };
}

function areaText(area, city) {
  const a = title(area.name);
  const c = title(city.name);
  const loc = `${a}, ${c}`;
  return {
    rentMetaTitle: `Houses, Portions & Flats for Rent in ${loc} | ${BRAND}`,
    rentMetaDescription: clip(`Houses, upper and lower portions, flats and rooms for rent in ${loc}. See monthly rents and photos, and contact owners and dealers directly on ${BRAND}.`),
    rentContent:
      `<p>Browse houses, upper and lower portions, flats and rooms for rent in ${loc}. Every listing on ${BRAND} shows the monthly rent, size and real photos.</p>` +
      `<p>Narrow the list by property type, size and budget, then call or WhatsApp the owner or dealer directly. Visit the place and agree the rent, advance and notice period in writing before you pay.</p>`,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

const empty = (v) => v == null || String(v).trim() === '';

(async () => {
  const uri = readEnvUri();
  if (!uri) {
    console.error('MONGODB_URI is not set (apps/api/.env).');
    process.exit(1);
  }
  const client = await MongoClient.connect(uri);
  const db = client.db();
  console.log(`${DRY ? '[dry run] ' : ''}${OVERWRITE ? '[overwrite] ' : ''}database: ${db.databaseName}\n`);

  const cities = await db.collection('cities').find({}).toArray();
  const areas = await db.collection('areas').find({ mergedIntoSlug: { $in: [null, ''] } }).toArray();

  // Listings per area (any status — drafts count, they are about to be published), and per area + type.
  // property.area may be stored as a string or an ObjectId.
  const counts = await db
    .collection('properties')
    .aggregate([{ $group: { _id: { area: { $toString: '$area' }, type: '$propertyType' }, n: { $sum: 1 } } }])
    .toArray();
  const byArea = new Map();
  const byAreaType = new Map();
  for (const { _id, n } of counts) {
    if (!_id.area) continue;
    byArea.set(_id.area, (byArea.get(_id.area) || 0) + n);
    byAreaType.set(`${_id.area}|${_id.type}`, n);
  }
  const topAreas = (cityId, type) =>
    areas
      .filter((a) => String(a.city) === String(cityId))
      .map((a) => ({ name: title(a.name), n: type ? byAreaType.get(`${a._id}|${type}`) || 0 : byArea.get(String(a._id)) || 0 }))
      .filter((x) => x.n > 0)
      .sort((x, y) => y.n - x.n)
      .map((x) => x.name);

  let cityFields = 0;
  let typeEntries = 0;
  let areaFields = 0;

  // Cities + city × type
  for (const city of cities) {
    const set = {};
    const ct = cityText(city, topAreas(city._id));
    for (const [k, v] of Object.entries(ct)) if (OVERWRITE || empty(city[k])) set[k] = v;

    const existing = Array.isArray(city.typeContents) ? city.typeContents.map((t) => ({ ...t })) : [];
    let typesChanged = false;
    for (const slug of Object.keys(TYPES)) {
      const gen = cityTypeText(city, slug, topAreas(city._id, slug));
      const entry = existing.find((t) => String(t.propertyType).toLowerCase() === slug && (t.purpose === 'rent' || t.purpose === 'all'));
      if (!entry) {
        existing.push({ _id: new ObjectId(), propertyType: slug, purpose: 'rent', ...gen });
        typesChanged = true;
        typeEntries++;
        continue;
      }
      let entryChanged = false;
      for (const [k, v] of Object.entries(gen)) {
        if (OVERWRITE || empty(entry[k])) {
          entry[k] = v;
          entryChanged = true;
        }
      }
      if (entryChanged) {
        typesChanged = true;
        typeEntries++;
      }
    }
    if (typesChanged) set.typeContents = existing;

    if (Object.keys(set).length) {
      cityFields += Object.keys(set).filter((k) => k !== 'typeContents').length;
      console.log(`city  ${title(city.name).padEnd(16)} ${Object.keys(set).join(', ')}`);
      if (!DRY) await db.collection('cities').updateOne({ _id: city._id }, { $set: { ...set, updatedAt: new Date() } });
    }
  }

  // Areas
  const cityById = new Map(cities.map((c) => [String(c._id), c]));
  let areasTouched = 0;
  for (const area of areas) {
    const city = cityById.get(String(area.city));
    if (!city) continue;
    const set = {};
    for (const [k, v] of Object.entries(areaText(area, city))) if (OVERWRITE || empty(area[k])) set[k] = v;
    if (!Object.keys(set).length) continue;
    areasTouched++;
    areaFields += Object.keys(set).length;
    if (!DRY) await db.collection('areas').updateOne({ _id: area._id }, { $set: { ...set, updatedAt: new Date() } });
  }

  console.log(`\n${DRY ? 'Would update' : 'Updated'}: ${cityFields} city fields, ${typeEntries} city × type pages, ${areasTouched} areas (${areaFields} fields).`);
  if (!DRY && (cityFields || typeEntries || areasTouched)) console.log('Live site: run  pm2 restart pakhotels-api pakhotels-web  so the pages pick it up.');
  await client.close();
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
