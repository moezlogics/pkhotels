/*
 * PakHotels — export the LOCAL database into one file for the live server.
 *
 *   node scripts/db/export-local.js
 *
 * Reads MONGODB_URI from apps/api/.env (must be a database on this machine)
 * and writes deploy/pakhotels-db.json.gz: every collection as Extended JSON,
 * so ObjectIds and dates survive exactly. Upload that file to the server
 * (same path) together with the uploads/ folder, then run
 * scripts/db/import-live.js there.
 *
 * What changes on the way:
 *   - Listings copied from other portals (source = olx.com.pk, zameen.com …)
 *     are exported as DRAFTS, so nothing goes public until someone opens it
 *     in Dashboard → Properties and publishes it.
 *   - Browser-push data (subscribers, jobs, stats, the VAPID keys) is left
 *     out: the live site makes its own keys on first start.
 *
 * The output file is git-ignored — it holds every account and listing, so it
 * never goes into the repository.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { MongoClient, BSON } = require('mongodb');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'deploy', 'pakhotels-db.json.gz');

/** Not copied: device subscriptions and push bookkeeping are per-site. */
const SKIP = new Set(['pushsubscribers', 'pushjobs', 'pushstats', 'pushsettings', 'pushcampaigns']);
/** Listings from these sources go live as drafts. */
const IMPORTED_SOURCES = /olx|zameen|graana|lamudi|scrap|import/i;

function readEnvUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const file = path.join(ROOT, 'apps', 'api', '.env');
  const line = fs.existsSync(file) && fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('MONGODB_URI='));
  return line ? line.slice('MONGODB_URI='.length).trim() : '';
}

(async () => {
  const uri = readEnvUri();
  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/[\w-]+$/.test(uri)) {
    console.error(`Refusing: expected a local MONGODB_URI (mongodb://localhost:27017/<db>), got "${uri || '(empty)'}".`);
    process.exit(1);
  }
  const client = await MongoClient.connect(uri);
  const db = client.db();
  const dump = { exportedAt: new Date().toISOString(), database: db.databaseName, collections: {} };
  let drafted = 0;

  for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
    if (SKIP.has(name) || name.startsWith('system.')) continue;
    const docs = await db.collection(name).find({}).toArray();
    if (name === 'properties') {
      for (const d of docs) {
        if (d.source && IMPORTED_SOURCES.test(String(d.source)) && d.status !== 'draft') {
          d.status = 'draft';
          d.autoPublished = false;
          drafted++;
        }
      }
    }
    dump.collections[name] = docs;
    console.log(`${name.padEnd(20)} ${docs.length}`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const json = BSON.EJSON.stringify(dump, { relaxed: false });
  fs.writeFileSync(OUT, zlib.gzipSync(json, { level: 9 }));
  await client.close();
  console.log(`\nImported-portal listings set to draft: ${drafted}`);
  console.log(`Wrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)} MB)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
