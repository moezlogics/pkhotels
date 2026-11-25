/*
 * PakHotels — export the site's CONTENT from the local database into the
 * seed file that ships with the repository:
 *
 *   npm run db:export        → deploy/seed/pakhotels-seed.json.gz  (commit it)
 *
 * On the server, scripts/db/import-live.js creates the MongoDB database and
 * user and loads this file — so a fresh clone is all the server needs.
 *
 * What goes in: hotels, rooms, prices calendar, cities, areas, plans, boost
 * prices, payment accounts, static pages, blog, media library, site settings,
 * and the setup-migration markers.
 *
 * What never goes in (it would publish people's data in the repository, and
 * the live site starts these empty): accounts, bookings, invoices,
 * subscriptions, reviews, hotel claims and browser-push data. Hotels go out
 * unclaimed and with their test counters (views, bookings, ratings) reset.
 *
 * Reads MONGODB_URI from apps/api/.env.local (this PC), never the live .env.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { MongoClient, BSON } = require(require.resolve('mongodb', { paths: [path.join(__dirname, '..', '..', 'apps', 'api'), __dirname] }));

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'deploy', 'seed', 'pakhotels-seed.json.gz');

/** Content collections, in load order. Anything else stays on this PC. */
const INCLUDE = [
  'cities', 'areas', 'hotels', 'rooms', 'roomrates', 'packages', 'boost_plans', 'paymentmethods',
  'pages', 'blogs', 'categories', 'media', 'site_settings', 'datamigrations',
];

function readEnvUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  for (const name of ['.env.local', '.env']) {
    const file = path.join(ROOT, 'apps', 'api', name);
    if (!fs.existsSync(file)) continue;
    const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('MONGODB_URI='));
    if (line) return line.slice('MONGODB_URI='.length).trim();
  }
  return '';
}

(async () => {
  const uri = readEnvUri();
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/[\w-]+$/.test(uri)) {
    console.error(`Refusing: expected a local MONGODB_URI (mongodb://localhost:27017/<db>), got "${uri ? uri.replace(/\/\/[^@]*@/, '//***@') : '(empty)'}".`);
    process.exit(1);
  }
  const client = await MongoClient.connect(uri);
  const db = client.db();
  const have = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const dump = { exportedAt: new Date().toISOString(), database: db.databaseName, collections: {} };

  for (const name of INCLUDE) {
    if (!have.has(name)) continue;
    const docs = await db.collection(name).find({}).toArray();
    if (name === 'hotels') {
      for (const h of docs) {
        // Accounts are not exported, so no hotel may point at one.
        delete h.owner;
        delete h.boostTopUntil;
        delete h.boostFeaturedUntil;
        h.billingHold = false;
        h.views = 0;
        h.bookingsCount = 0;
        h.ratingAvg = 0;
        h.ratingCount = 0;
        h.rank = 0;
        if (h.perks) h.perks = { ...h.perks, plan: 'Unclaimed', boostTop: false, boostFeatured: false, commissionPercent: 0 };
      }
    }
    dump.collections[name] = docs;
    console.log(`${name.padEnd(18)} ${docs.length}`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, zlib.gzipSync(BSON.EJSON.stringify(dump, { relaxed: false }), { level: 9 }));
  await client.close();
  console.log(`\nWrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB). Commit it, then git push.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
