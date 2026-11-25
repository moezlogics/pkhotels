/*
 * PakHotels — one-time live setup: creates the MongoDB user and database,
 * loads the site content that ships with the repository, and creates the
 * dashboard admin. Run ON THE SERVER, from the project folder (see DEPLOY.md):
 *
 *   node scripts/db/import-live.js          (or: npm run db:import)
 *
 * Everything it needs is in apps/api/.env:
 *   MONGODB_URI     mongodb://pakhotels:PASSWORD@127.0.0.1:27017/pakhotels?authSource=pakhotels
 *   ADMIN_EMAIL     the dashboard login to create
 *   ADMIN_PASSWORD  its password (removed from the server's .env afterwards)
 *
 * What it does, in order:
 *   1. Makes sure the MongoDB user in MONGODB_URI exists with that password,
 *      with access to that one database only (readWrite + dbAdmin):
 *        - user already works               -> left alone
 *        - MongoDB has no login switched on  -> user created directly
 *        - MongoDB asks for a login and no admin login is given -> (as root)
 *          authentication is switched OFF in /etc/mongod.conf, MongoDB
 *          restarted, the user created, then switched back ON exactly as it
 *          was. Or pass an admin login:
 *            --admin-uri 'mongodb://ADMIN:PASS@127.0.0.1:27017/?authSource=admin'
 *   2. Creates the database and loads deploy/seed/pakhotels-seed.json.gz
 *      (hotels, rooms, cities, areas, plans, boost prices, settings...). The
 *      seed has no accounts or bookings — the live site starts those empty.
 *   3. Creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD (or
 *      --admin-email / --admin-password), then blanks ADMIN_PASSWORD in the
 *      server's apps/api/.env so the password is not left in a file.
 *   4. Locks apps/api/.env and apps/web/.env to their owner (chmod 600).
 *
 * Safety:
 *   - Refuses to touch a database that already has hotels or accounts, unless
 *     you pass --replace (drops and reloads the content collections; accounts
 *     and bookings are never touched).
 *   - --dry-run shows what would happen and changes nothing.
 *   - Advanced: --file <seed>, --mongod-conf <path>, --restart-cmd '<command>'.
 *
 * Photos are not in the seed: upload the uploads/ folder to <project>/uploads.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');
const { MongoClient, BSON } = require('mongodb');
const bcrypt = require('bcrypt');

const ROOT = path.join(__dirname, '..', '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY = flag('dry-run');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ENV_FILE = path.join(ROOT, 'apps', 'api', '.env');

/** One value from apps/api/.env (the live file), or the process environment. */
function readEnv(key) {
  if (process.env[key]) return process.env[key];
  if (!fs.existsSync(ENV_FILE)) return '';
  const line = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : '';
}
const readEnvUri = () => readEnv('MONGODB_URI');

/** The admin password should not stay in a file once the account exists. */
function blankAdminPassword() {
  if (!fs.existsSync(ENV_FILE)) return;
  const text = fs.readFileSync(ENV_FILE, 'utf8');
  const next = text.replace(/^ADMIN_PASSWORD=.*$/m, 'ADMIN_PASSWORD=');
  if (next !== text) {
    fs.writeFileSync(ENV_FILE, next);
    console.log('Removed ADMIN_PASSWORD from apps/api/.env (the account exists now; keep the password safe yourself).');
  }
}

const isAuthError = (e) => e && (e.code === 18 || /Authentication failed|auth.*fail/i.test(e.message || ''));
const isUnauthorized = (e) => e && (e.code === 13 || /requires authentication|not authorized|Unauthorized/i.test(e.message || ''));

// ── MongoDB user ────────────────────────────────────────────────────────────

/** Creates the user (or resets its password) through a connection that is allowed to. */
async function createUserVia(connectUri, user, pwd, dbName, authDb) {
  const roles = [
    { role: 'readWrite', db: dbName },
    { role: 'dbAdmin', db: dbName },
  ];
  const c = await MongoClient.connect(connectUri, { serverSelectionTimeoutMS: 5000 });
  try {
    const target = c.db(authDb);
    const info = await target.command({ usersInfo: user });
    if (info.users && info.users.length) {
      await target.command({ updateUser: user, pwd, roles });
      console.log(`MongoDB user "${user}": password reset to match apps/api/.env.`);
    } else {
      await target.command({ createUser: user, pwd, roles });
      console.log(`MongoDB user "${user}": created (readWrite + dbAdmin on "${dbName}" only).`);
    }
  } finally {
    await c.close();
  }
}

function restartMongod() {
  let cmd = opt('restart-cmd');
  if (!cmd) {
    for (const svc of ['mongod', 'mongodb']) {
      try {
        execSync(`systemctl cat ${svc}.service`, { stdio: 'ignore' });
        cmd = `systemctl restart ${svc}`;
        break;
      } catch {
        /* try the next name */
      }
    }
  }
  if (!cmd) throw new Error('Could not find the MongoDB service (mongod) to restart.');
  execSync(cmd, { stdio: 'inherit' });
}

async function waitForMongo(hostUri) {
  for (let i = 0; i < 40; i++) {
    try {
      const c = await MongoClient.connect(hostUri, { serverSelectionTimeoutMS: 1500 });
      await c.db('admin').command({ ping: 1 });
      await c.close();
      return;
    } catch {
      await sleep(750);
    }
  }
  throw new Error('MongoDB did not come back up after the restart.');
}

/** Switches authentication off in mongod.conf, runs fn, and always switches it back on. */
async function withAuthSwitchedOff(hostUri, fn) {
  const conf = opt('mongod-conf') || '/etc/mongod.conf';
  if (!fs.existsSync(conf)) throw new Error(`MongoDB config not found at ${conf} (pass --mongod-conf <path>).`);
  const original = fs.readFileSync(conf, 'utf8');
  const re = /^(\s*authorization\s*:\s*)["']?enabled["']?/m;
  if (!re.test(original)) {
    throw new Error(`MongoDB asks for a login, but ${conf} has no "authorization: enabled" line to switch off.`);
  }
  const backup = `${conf}.pakhotels-backup`;
  fs.writeFileSync(backup, original);

  console.log('MongoDB asks for a login and no admin login was given: switching authentication OFF for a moment…');
  fs.writeFileSync(conf, original.replace(re, '$1disabled'));
  let failed = null;
  try {
    restartMongod();
    await waitForMongo(hostUri);
    await fn();
  } catch (e) {
    failed = e;
  }

  console.log('Switching MongoDB authentication back ON…');
  fs.writeFileSync(conf, original);
  try {
    restartMongod();
    await waitForMongo(hostUri);
  } catch (e) {
    console.error(`\nThe original ${conf} is back in place, but MongoDB did not restart cleanly: run  systemctl restart mongod`);
    throw e;
  }
  fs.unlinkSync(backup);
  console.log('MongoDB authentication is ON again.');
  if (failed) throw failed;
}

/**
 * Step 1: make sure the MongoDB user in MONGODB_URI exists and can log in.
 * Returns the URI to read/write the data with, or null in a dry run where the
 * user does not exist yet (nothing can be read then).
 */
async function ensureDbUser(uri, dbName) {
  const u = new URL(uri);
  const user = decodeURIComponent(u.username);
  const pwd = decodeURIComponent(u.password);
  if (!user) {
    console.log('MONGODB_URI has no user in it: connecting without a MongoDB login.');
    return uri;
  }
  const authDb = u.searchParams.get('authSource') || dbName;
  const hostUri = `mongodb://${u.host}/`;

  // Already set up?
  try {
    const c = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 5000 });
    await c.db(dbName).command({ ping: 1 });
    await c.close();
    console.log(`MongoDB user "${user}": already exists, login OK.`);
    return uri;
  } catch (e) {
    if (!isAuthError(e)) throw e;
  }

  if (DRY) {
    console.log(`would create MongoDB user "${user}" (readWrite + dbAdmin on "${dbName}")`);
    return null;
  }

  // An admin login was given: use it.
  if (opt('admin-uri')) {
    await createUserVia(opt('admin-uri'), user, pwd, dbName, authDb);
    return uri;
  }

  // No admin login: works straight away when MongoDB has authentication off.
  try {
    await createUserVia(hostUri, user, pwd, dbName, authDb);
    return uri;
  } catch (e) {
    if (!isUnauthorized(e)) throw e;
  }

  // Authentication is on and we have no admin login: off → create → on.
  if (process.platform !== 'win32' && process.getuid && process.getuid() !== 0) {
    console.error('\nMongoDB asks for a login. To create the user without the admin password, this script switches');
    console.error('authentication off for a moment and back on, which needs root. Run it again as root (see DEPLOY.md).');
    process.exit(1);
  }
  await withAuthSwitchedOff(hostUri, () => createUserVia(hostUri, user, pwd, dbName, authDb));
  return uri;
}

// ── Clean-up ────────────────────────────────────────────────────────────────

/** Only the file's owner may read the secrets files (Linux; ignored elsewhere). */
function lockEnvFiles() {
  for (const rel of ['apps/api/.env', 'apps/web/.env']) {
    const f = path.join(ROOT, rel);
    if (!fs.existsSync(f)) continue;
    try {
      fs.chmodSync(f, 0o600);
      console.log(`Locked ${rel} (owner read/write only)`);
    } catch {
      /* Windows or a read-only mount — nothing to do */
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

(async () => {
  // Check everything first, so a mistake stops the script before it changes anything.
  const file = path.resolve(ROOT, opt('file') || 'deploy/seed/pakhotels-seed.json.gz');
  const uri = readEnvUri();
  if (!uri) {
    console.error('MONGODB_URI is not set. Copy the live .env to apps/api/.env first.');
    process.exit(1);
  }
  if (/CHANGE_ME/i.test(uri)) {
    console.error('MONGODB_URI still has the placeholder password. Put your own password in apps/api/.env first');
    console.error('(letters and numbers only — e.g. the output of:  openssl rand -hex 16).');
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`Not found: ${file}\nIt ships with the repository: run git pull.`);
    process.exit(1);
  }
  const adminEmail = (opt('admin-email') || readEnv('ADMIN_EMAIL')).trim().toLowerCase();
  const adminPassword = opt('admin-password') || readEnv('ADMIN_PASSWORD');
  if (!DRY && (!adminEmail || adminPassword.length < 10)) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (10+ characters) in apps/api/.env, or pass --admin-email / --admin-password.');
    process.exit(1);
  }
  let dbName;
  try {
    dbName = new URL(uri).pathname.replace(/^\//, '');
  } catch {
    console.error('MONGODB_URI is not a valid address. Use letters and numbers only in the password.');
    process.exit(1);
  }
  if (!dbName) {
    console.error('MONGODB_URI has no database name (…:27017/pakhotels).');
    process.exit(1);
  }

  const dump = BSON.EJSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'), { relaxed: false });
  const names = Object.keys(dump.collections);
  console.log(`Dump from ${dump.exportedAt} (${dump.database}) → ${uri.replace(/\/\/[^@]*@/, '//***@')}\n`);

  // 1. MongoDB user
  const workUri = await ensureDbUser(uri, dbName);
  if (!workUri) {
    for (const name of names) console.log(`would load ${name.padEnd(20)} ${dump.collections[name].length}`);
    return;
  }

  // 2. Database + data
  const client = await MongoClient.connect(workUri);
  const db = client.db(dbName);
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const busy = [];
  for (const n of ['hotels', 'users']) {
    if (existing.has(n) && (await db.collection(n).estimatedDocumentCount()) > 0) busy.push(n);
  }
  if (busy.length && !flag('replace') && !DRY) {
    console.error(`The live database already has data in: ${busy.join(', ')}.\nRun again with --replace to reload the content (hotels, rooms, cities...). Accounts and bookings are never touched.`);
    await client.close();
    process.exit(1);
  }

  for (const name of names) {
    const docs = dump.collections[name];
    if (DRY) {
      console.log(`would load ${name.padEnd(20)} ${docs.length}`);
      continue;
    }
    if (existing.has(name)) await db.collection(name).drop();
    if (docs.length) await db.collection(name).insertMany(docs, { ordered: false });
    else await db.createCollection(name).catch(() => undefined);
    console.log(`loaded ${name.padEnd(20)} ${docs.length}`);
  }

  // 3. Admin login
  if (!DRY) {
    const users = db.collection('users');
    const hash = await bcrypt.hash(adminPassword, 12);
    const now = new Date();
    // The admin from the dump takes the new email/password; otherwise one is created.
    const admin = (await users.findOne({ email: adminEmail })) || (await users.findOne({ role: 'ADMIN' }));
    if (admin) {
      await users.updateOne({ _id: admin._id }, { $set: { email: adminEmail, password: hash, role: 'ADMIN', isActive: true, provider: 'credentials', updatedAt: now } });
    } else {
      await users.insertOne({ email: adminEmail, name: 'Admin', password: hash, role: 'ADMIN', isActive: true, provider: 'credentials', createdAt: now, updatedAt: now });
    }
    const live = await db.collection('hotels').countDocuments({ status: 'approved' });
    const rooms = await db.collection('rooms').estimatedDocumentCount();
    console.log(`\nDatabase "${dbName}" ready: ${live} live hotels, ${rooms} room types.`);
    console.log(`Admin login: ${adminEmail}`);
  }
  await client.close();

  // 4. Clean up: the admin password out of the file, the secrets locked.
  if (!DRY) {
    if (!opt('admin-password')) blankAdminPassword();
    lockEnvFiles();
    console.log('\nNext, as the site user:  bash deploy/deploy.sh');
  }
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
