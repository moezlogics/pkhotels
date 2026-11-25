/*
 * PakHotels — local development data. NEVER for a live database.
 *
 *   npm run seed:local            (uses apps/api/.env → MONGODB_URI)
 *
 * Creates a local admin account and a starter set of cities (with their local
 * /uploads/cities/<slug>.jpg thumbnails) and areas, so the dashboard and
 * "List your hotel" work on a fresh database. It refuses to run against anything
 * that is not a MongoDB on this machine. Safe to run again: everything is an
 * upsert, and the admin password is reset to the one below.
 *
 * Local admin (this machine only — change it before going live):
 */
const LOCAL_ADMIN = { email: 'admin@pakhotels.local', password: 'PakHotels-local-2026!', name: 'Admin' };

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

function readEnvUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const file = path.join(__dirname, '..', 'apps', 'api', '.env');
  const line = fs.existsSync(file) && fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('MONGODB_URI='));
  return line ? line.slice('MONGODB_URI='.length).trim() : '';
}

const uri = readEnvUri();
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/[\w-]+$/.test(uri)) {
  console.error(`Refusing: MONGODB_URI must be a local database (mongodb://localhost:27017/<name>). Got: ${uri ? uri.replace(/\/\/.*@/, '//***@') : '(empty)'}`);
  process.exit(1);
}

/** Starter hotel destinations and the areas guests search for (more can be added from the dashboard). */
const CITIES = {
  Lahore: { state: 'Punjab', areas: ['gulberg', 'mm alam road', 'mall road', 'johar town', 'dha', 'model town', 'airport road', 'faisal town', 'shadman', 'garden town'] },
  Islamabad: { state: 'Islamabad Capital Territory', areas: ['blue area', 'f-6', 'f-7', 'f-8', 'g-9', 'e-11', 'g-11', 'i-8', 'bahria enclave'] },
  Karachi: { state: 'Sindh', areas: ['shahrah-e-faisal', 'clifton', 'dha', 'saddar', 'gulshan-e-iqbal', 'pechs', 'airport', 'tariq road'] },
  Multan: { state: 'Punjab', areas: ['cantt', 'gulgasht colony', 'bosan road', 'abdali road', 'lalazar', 'dha multan'] },
  Rawalpindi: { state: 'Punjab', areas: ['saddar', 'murree road', 'bahria town', 'committee chowk', 'airport road'] },
  Peshawar: { state: 'Khyber Pakhtunkhwa', areas: ['saddar', 'university road', 'hayatabad', 'gt road'] },
  Faisalabad: { state: 'Punjab', areas: ['d ground', 'susan road', 'canal road', 'kohinoor city'] },
  Murree: { state: 'Punjab', areas: ['mall road', 'bhurban', 'patriata', 'jhika gali', 'kashmir point'] },
  Naran: { state: 'Khyber Pakhtunkhwa', areas: ['naran bazaar', 'kaghan', 'saiful muluk road'] },
  Swat: { state: 'Khyber Pakhtunkhwa', areas: ['mingora', 'kalam', 'malam jabba', 'madyan', 'bahrain'] },
  Hunza: { state: 'Gilgit-Baltistan', areas: ['karimabad', 'aliabad', 'gulmit', 'passu'] },
  Skardu: { state: 'Gilgit-Baltistan', areas: ['skardu city', 'shangrila', 'satpara', 'shigar'] },
  Gilgit: { state: 'Gilgit-Baltistan', areas: ['jutial', 'airport road', 'nagar'] },
  Abbottabad: { state: 'Khyber Pakhtunkhwa', areas: ['mandian', 'jinnahabad', 'nathia gali', 'thandiani'] },
  Quetta: { state: 'Balochistan', areas: ['jinnah road', 'airport road', 'samungli road'] },
  Hyderabad: { state: 'Sindh', areas: ['autobahn road', 'qasimabad', 'saddar'] },
  Bahawalpur: { state: 'Punjab', areas: ['model town a', 'circular road', 'cantt'] },
  Sialkot: { state: 'Punjab', areas: ['cantt', 'paris road', 'kashmir road'] },
};

const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

(async () => {
  const client = await MongoClient.connect(uri);
  const db = client.db();
  const now = new Date();

  const admin = await db.collection('users').findOneAndUpdate(
    { email: LOCAL_ADMIN.email },
    {
      $set: { email: LOCAL_ADMIN.email, name: LOCAL_ADMIN.name, role: 'ADMIN', isActive: true, provider: 'credentials', password: await bcrypt.hash(LOCAL_ADMIN.password, 10), updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: 'after' },
  );

  let areaCount = 0;
  for (const [name, info] of Object.entries(CITIES)) {
    const citySlug = slug(name);
    const city = await db.collection('cities').findOneAndUpdate(
      { name },
      {
        $set: {
          name,
          areaSlug: citySlug,
          state: info.state,
          country: 'Pakistan',
          ...(fs.existsSync(path.join(__dirname, '..', 'uploads', 'cities', `${citySlug}.jpg`)) ? { thumbnail: `/uploads/cities/${citySlug}.jpg` } : {}),
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, returnDocument: 'after' },
    );
    const cityId = city._id ?? city.value?._id;
    for (const a of info.areas) {
      await db.collection('areas').updateOne(
        { areaSlug: slug(a), city: cityId },
        { $set: { name: a, areaSlug: slug(a), city: cityId, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true },
      );
      areaCount++;
    }
  }

  console.log(`Database: ${uri}`);
  console.log(`Cities: ${Object.keys(CITIES).length}, areas: ${areaCount}`);
  console.log(`Local admin: ${LOCAL_ADMIN.email} (password: see LOCAL_ADMIN in scripts/seed-local.js) — id ${admin._id ?? admin.value?._id}`);
  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
