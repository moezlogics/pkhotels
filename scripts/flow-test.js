/*
 * End-to-end check of reviews, boosts, commission invoices, overdue holds and
 * stay disputes against the LOCAL API and database. Never point this at
 * production: it creates test accounts, gives one hotel a test owner and moves
 * booking dates in the database to simulate last month.
 *
 *   node scripts/flow-test.js          run the checks (clears the last run first), keep the test data
 *   node scripts/flow-test.js --clean  remove everything the test created
 *
 * Test accounts (local only):
 */
const TEST_USERS = {
  owner: { name: 'Test Owner', email: 'owner.flow@pakhotels.local', password: 'flow-owner-2026', phone: '03001110001' },
  guest: { name: 'Ayesha Khan', email: 'guest.flow@pakhotels.local', password: 'flow-guest-2026', phone: '03001110002' },
  guest2: { name: 'Bilal Ahmed', email: 'guest2.flow@pakhotels.local', password: 'flow-guest2-2026', phone: '03001110003' },
};

const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require(require.resolve('mongodb', { paths: [path.join(__dirname, '..', 'apps', 'api'), __dirname] }));

const API = process.env.API || 'http://localhost:3205/api';
const DB = process.env.MONGODB_URI || 'mongodb://localhost:27017/pakhotels';
const src = fs.readFileSync(path.join(__dirname, 'seed-local.js'), 'utf8');
const am = src.match(/LOCAL_ADMIN = \{ email: '([^']+)', password: '([^']+)'/);
const ADMIN = { email: am[1], password: am[2] };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const results = [];
function check(name, ok, info = '') {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  — ${info}` : ''}`);
}

async function call(token, method, url, body) {
  const r = await fetch(API + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, data: j };
}
const tokenOf = (d) => d?.token || d?.access_token || d?.accessToken || d?.data?.token;

async function login(u, register = false) {
  let r = await call(null, 'POST', '/auth/login', { email: u.email, password: u.password });
  if (r.status >= 300 && register) {
    r = await call(null, 'POST', '/auth/register', { name: u.name, email: u.email, password: u.password });
    await sleep(500);
  }
  const t = tokenOf(r.data);
  if (!t) throw new Error(`login ${u.email}: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
  return t;
}

(async () => {
  const mongo = await MongoClient.connect(DB);
  const db = mongo.db();
  const users = db.collection('users');
  const hotels = db.collection('hotels');
  const bookings = db.collection('bookings');
  const invoices = db.collection('billing_invoices');
  const reviews = db.collection('hotelreviews');

  const clean = async (quiet) => {
    const ids = (await users.find({ email: { $in: Object.values(TEST_USERS).map((u) => u.email) } }).toArray()).map((u) => u._id);
    const hs = await hotels.find({ owner: { $in: ids } }).toArray();
    for (const h of hs) await hotels.updateOne({ _id: h._id }, { $unset: { owner: 1, boostTopUntil: 1, boostFeaturedUntil: 1 }, $set: { billingHold: false } });
    const b = await bookings.deleteMany({ user: { $in: ids } });
    const i = await invoices.deleteMany({ hotel: { $in: hs.map((h) => h._id) } });
    const rv = await reviews.deleteMany({ user: { $in: ids } });
    await users.deleteMany({ _id: { $in: ids } });
    if (!quiet) console.log(`Cleaned: ${hs.length} hotel(s) unclaimed, ${b.deletedCount} bookings, ${i.deletedCount} invoices, ${rv.deletedCount} reviews, ${ids.length} users. Restart the API (or wait ~10 min) to refresh hotel perks.`);
  };
  if (process.argv.includes('--clean')) {
    await clean(false);
    await mongo.close();
    return;
  }
  // Every run starts from scratch, so a second run never trips over the first one's data.
  await clean(true);

  const admin = await login(ADMIN);
  const owner = await login(TEST_USERS.owner, true);
  const guest = await login(TEST_USERS.guest, true);
  const guest2 = await login(TEST_USERS.guest2, true);
  const ownerId = (await users.findOne({ email: TEST_USERS.owner.email }))._id;
  await users.updateOne({ _id: ownerId }, { $set: { phone: TEST_USERS.owner.phone } });

  // A live hotel with a priced room: the test owner's, or an unclaimed one.
  let h = await hotels.findOne({ owner: ownerId });
  if (!h) {
    const roomsCol = db.collection('rooms');
    for (const c of await hotels.find({ status: 'approved', owner: { $exists: false }, acceptsBookings: true }).limit(40).toArray()) {
      if (await roomsCol.findOne({ hotel: c._id, isActive: true, price: { $gt: 0 }, quantity: { $gte: 2 } })) { h = c; break; }
    }
    if (!h) throw new Error('No unclaimed hotel with rooms found');
    const r = await call(admin, 'PATCH', `/hotels/admin/${h._id}`, { owner: String(ownerId) });
    check('Admin gives the hotel a test owner', r.status < 300, `${h.name} (${r.status})`);
  }
  const room = await db.collection('rooms').findOne({ hotel: h._id, isActive: true, price: { $gt: 0 } });
  const mine = await call(owner, 'GET', '/hotels/mine');
  check('Owner sees the hotel; Free plan carries 10% commission', mine.data?.perks?.commissionPercent === 10, `plan ${mine.data?.perks?.plan}, ${mine.data?.perks?.commissionPercent}%`);
  check('Commission plan has no monthly booking cap', mine.data?.usage?.monthlyBookings === 0);

  /* ── Boost ── */
  let bill = await call(owner, 'GET', '/billing/mine');
  const top7 = bill.data.boosts.plans.find((p) => p.placement === 'top' && p.days === 7);
  let inv = (await call(owner, 'POST', `/billing/boosts/${top7._id}/buy`)).data;
  check('Buying a boost makes an unpaid invoice', inv.status === 'unpaid' && inv.amount === top7.price, `${inv.number} Rs ${inv.amount}`);
  const again = (await call(owner, 'POST', `/billing/boosts/${top7._id}/buy`)).data;
  check('Buying the same boost twice reuses the open invoice', again._id === inv._id);
  const noProof = await call(owner, 'POST', `/billing/invoices/${inv._id}/payment`, { method: 'JazzCash' });
  check('Payment without a screenshot is refused', noProof.status === 400);
  const other = await call(guest, 'POST', `/billing/invoices/${inv._id}/payment`, { proofUrl: 'https://example.com/x.png' });
  check('Another account cannot pay/see this invoice', other.status === 403 || other.status === 404, `status ${other.status}`);
  await call(owner, 'POST', `/billing/invoices/${inv._id}/payment`, { proofUrl: 'https://example.com/proof.png', method: 'JazzCash', note: 'TID 123' });
  let sum = (await call(admin, 'GET', '/billing/admin/summary')).data;
  check('Admin sees it in "To verify"', sum.verify.n >= 1);
  await call(admin, 'POST', `/billing/admin/invoices/${inv._id}/reject`, { reason: 'Amount does not match' });
  bill = (await call(owner, 'GET', '/billing/mine')).data;
  check('Rejected payment shows the reason to the hotel', bill.invoices.find((i) => i._id === inv._id)?.rejectionReason === 'Amount does not match');
  await call(owner, 'POST', `/billing/invoices/${inv._id}/payment`, { proofUrl: 'https://example.com/proof2.png', method: 'JazzCash' });
  await call(admin, 'POST', `/billing/admin/invoices/${inv._id}/approve`);
  bill = (await call(owner, 'GET', '/billing/mine')).data;
  const hAfter = await hotels.findOne({ _id: h._id });
  const daysLive = bill.boosts.top ? Math.round((new Date(bill.boosts.top) - Date.now()) / 864e5) : 0;
  check('Approved boost goes live for its days', daysLive >= 6 && daysLive <= 8, `${daysLive} days`);
  check('Boosted hotel ranks above plan hotels and shows Featured', hAfter.rank >= 10 && hAfter.perks?.boostTop === true, `rank ${hAfter.rank}`);
  const list = (await call(null, 'GET', `/hotels?city=${h.citySlug}&limit=5`)).data;
  check('Boosted hotel is first on its city page', (list.items ?? list.hotels ?? [])[0]?._id === String(h._id), (list.items ?? [])[0]?.name);
  // Renewing early adds days after the current end.
  const inv2 = (await call(owner, 'POST', `/billing/boosts/${top7._id}/buy`)).data;
  await call(admin, 'POST', `/billing/admin/invoices/${inv2._id}/approve`);
  bill = (await call(owner, 'GET', '/billing/mine')).data;
  const days2 = Math.round((new Date(bill.boosts.top) - Date.now()) / 864e5);
  check('Renewing early stacks the days', days2 >= 13 && days2 <= 15, `${days2} days`);

  /* ── A booking that completes, and its commission ── */
  const t0 = today();
  const mk = async (token, phone, name) =>
    call(token, 'POST', '/bookings', { hotelId: String(h._id), checkIn: t0, checkOut: addDays(t0, 1), rooms: [{ roomId: String(room._id), qty: 1 }], guestName: name, guestPhone: phone, adults: 1 });
  const b1 = await mk(guest, TEST_USERS.guest.phone, TEST_USERS.guest.name);
  check('Guest books the hotel', b1.status < 300, b1.data.ref || JSON.stringify(b1.data).slice(0, 120));
  const b1doc = await bookings.findOne({ ref: b1.data.ref });
  check('Booking stores the 10% rate', b1doc?.commissionPercent === 10);
  for (const st of b1doc.status === 'pending' ? ['confirmed', 'checked_in', 'completed'] : ['checked_in', 'completed']) {
    const r = await call(owner, 'PATCH', `/bookings/${b1doc._id}/status`, { status: st });
    if (r.status >= 300) check(`Owner marks ${st}`, false, JSON.stringify(r.data).slice(0, 120));
  }
  bill = (await call(owner, 'GET', '/billing/mine')).data;
  const expected = Math.round((b1doc.total * 10) / 100);
  check('"Not billed yet" shows the completed stay', bill.thisMonth.amount >= expected && bill.thisMonth.bookings >= 1, `Rs ${bill.thisMonth.amount}`);

  // Pretend the stay was last month, then bill last month.
  const lm = new Date(Date.parse(t0.slice(0, 7) + '-01T00:00:00Z') - 864e5).toISOString().slice(0, 7);
  await bookings.updateOne({ _id: b1doc._id }, { $set: { checkIn: `${lm}-10`, checkOut: `${lm}-11` } });
  const early = await call(admin, 'POST', '/billing/admin/generate', { period: t0.slice(0, 7) });
  check('The current month cannot be billed yet', early.status === 400);
  const gen = (await call(admin, 'POST', '/billing/admin/generate', { period: lm })).data;
  check('Billing last month creates the commission invoice', gen.created >= 1, `${gen.created} invoice(s), Rs ${gen.amount}`);
  const gen2 = (await call(admin, 'POST', '/billing/admin/generate', { period: lm })).data;
  check('Running it again does not bill twice', gen2.created === 0);
  const ci = await invoices.findOne({ hotel: h._id, kind: 'commission', period: lm });
  check('Invoice amount = 10% of the stay', ci && ci.amount === expected && ci.lines.some((l) => l.ref === b1doc.ref), `Rs ${ci?.amount} vs ${expected}`);

  /* ── Overdue → booking paused → paid → resumed ── */
  await invoices.updateOne({ _id: ci._id }, { $set: { dueDate: new Date(Date.now() - 20 * 864e5) } });
  sum = (await call(admin, 'GET', '/billing/admin/summary')).data; // refreshes holds
  const fu = (await call(admin, 'GET', '/billing/admin/follow-ups')).data;
  const row = fu.find((x) => x.id === String(ci._id));
  check('Overdue invoice is on the follow-up list with a WhatsApp message', row?.kind === 'overdue' && row.days >= 19 && /PakHotels invoice/.test(row.message), `${row?.days} days late`);
  check('Hotel 15+ days overdue is paused', (await hotels.findOne({ _id: h._id })).billingHold === true && sum.holds >= 1);
  const pub = (await call(null, 'GET', `/hotels/slug/${h.slug}`)).data;
  check('Public page stops online booking while paused', pub.booking?.open === false);
  const blocked = await mk(guest2, TEST_USERS.guest2.phone, TEST_USERS.guest2.name);
  check('A new booking is refused while paused', blocked.status === 400);
  await call(owner, 'POST', `/billing/invoices/${ci._id}/payment`, { proofUrl: 'https://example.com/c.png', method: 'Bank' });
  await call(admin, 'POST', `/billing/admin/invoices/${ci._id}/approve`);
  check('Paying lifts the pause', (await hotels.findOne({ _id: h._id })).billingHold === false);

  /* ── Fake no-show and the guest's "I stayed" ── */
  const b2 = await mk(guest, TEST_USERS.guest.phone, TEST_USERS.guest.name);
  const b2doc = await bookings.findOne({ ref: b2.data.ref });
  if (b2doc.status === 'pending') await call(owner, 'PATCH', `/bookings/${b2doc._id}/status`, { status: 'confirmed' });
  await bookings.updateOne({ _id: b2doc._id }, { $set: { checkIn: addDays(t0, -1) } });
  const cancelLate = await call(owner, 'PATCH', `/bookings/${b2doc._id}/status`, { status: 'cancelled', note: 'x' });
  check('Hotel cannot cancel after the check-in date', cancelLate.status === 400);
  const nsBare = await call(owner, 'PATCH', `/bookings/${b2doc._id}/status`, { status: 'no_show' });
  check('No-show needs a note', nsBare.status === 400);
  await call(owner, 'PATCH', `/bookings/${b2doc._id}/status`, { status: 'no_show', note: 'Guest did not arrive' });
  const tok = (await bookings.findOne({ _id: b2doc._id }, { projection: { token: 1 } })).token;
  const view = (await call(null, 'GET', `/bookings/ref/${b2doc.ref}?t=${tok}`)).data;
  check('Guest sees "Did you actually stay?"', view.canDispute === true);
  await call(null, 'POST', `/bookings/ref/${b2doc.ref}/stayed`, { t: tok, note: 'We stayed in room 12' });
  const fu2 = (await call(admin, 'GET', '/billing/admin/follow-ups')).data;
  check('Dispute reaches the admin list first', fu2[0]?.kind === 'dispute');
  await call(admin, 'POST', `/billing/admin/disputes/${b2doc._id}`, { decision: 'upheld' });
  const b2after = await bookings.findOne({ _id: b2doc._id });
  check('Upheld dispute completes the booking (billable)', b2after.status === 'completed' && b2after.stayDispute === 'upheld');

  /* ── Cancelling: only until the hotel confirms ── */
  const c1 = await mk(guest, TEST_USERS.guest.phone, TEST_USERS.guest.name);
  const c1doc = await bookings.findOne({ ref: c1.data.ref }, { projection: { token: 1, status: 1 } });
  if (c1doc.status === 'pending') {
    const v1 = (await call(null, 'GET', `/bookings/ref/${c1.data.ref}?t=${c1doc.token}`)).data;
    check('Guest can cancel while the request is pending', v1.canCancel === true);
  }
  if (c1doc.status === 'pending') await call(owner, 'PATCH', `/bookings/${c1doc._id}/status`, { status: 'confirmed' });
  const v2 = (await call(null, 'GET', `/bookings/ref/${c1.data.ref}?t=${c1doc.token}`)).data;
  check('After the hotel confirms, the guest cannot cancel', v2.canCancel === false && /no longer be cancelled/.test(v2.cancelNote));
  const tryCancel = await call(null, 'POST', `/bookings/ref/${c1.data.ref}/cancel`, { t: c1doc.token, reason: 'x' });
  check('Cancelling a confirmed booking is refused by the API', tryCancel.status === 400);
  check('Booking page carries the hotel phone to call', !!(v2.hotel?.phone || v2.hotel?.whatsapp));
  await call(owner, 'PATCH', `/bookings/${c1doc._id}/status`, { status: 'cancelled', note: 'test cleanup' });

  /* ── Guests from abroad ── */
  const intl = { hotelId: String(h._id), checkIn: addDays(t0, 3), checkOut: addDays(t0, 4), rooms: [{ roomId: String(room._id), qty: 1 }], guestName: 'Sarah Jones', adults: 1 };
  await users.updateOne({ email: TEST_USERS.guest2.email }, { $set: { email: TEST_USERS.guest2.email } });
  const badPhone = await call(guest2, 'POST', '/bookings', { ...intl, guestPhone: '7911 123456' });
  check('A foreign number without its country code is refused', badPhone.status === 400);
  await hotels.updateOne({ _id: h._id }, { $set: { acceptsForeigners: 'no' } });
  const blockedF = await call(guest2, 'POST', '/bookings', { ...intl, guestPhone: '+44 7911 123456', guestForeign: true, guestCountry: 'GB' });
  check('A foreign passport holder cannot book a hotel that hosts no foreigners', blockedF.status === 400 && /foreign/.test(JSON.stringify(blockedF.data)));
  await hotels.updateOne({ _id: h._id }, { $set: { acceptsForeigners: 'yes' } });
  const noCountry = await call(guest2, 'POST', '/bookings', { ...intl, guestPhone: '+44 7911 123456', guestForeign: true });
  check('A foreign guest must say which passport', noCountry.status === 400);
  const okF = await call(guest2, 'POST', '/bookings', { ...intl, guestPhone: '+44 7911 123456', guestForeign: true, guestCountry: 'GB', bookerName: 'Bilal Ahmed', bookerPhone: '03001110003' });
  const fdoc = okF.data.ref ? await bookings.findOne({ ref: okF.data.ref }) : null;
  check('Foreign guest books with a UK number (email taken from the account)', okF.status < 300 && fdoc?.guestPhone === '+447911123456' && fdoc?.guestForeign === true && fdoc?.guestCountry === 'GB' && !!fdoc?.guestEmail, JSON.stringify(okF.data).slice(0, 120));
  check('"Booked by" is kept for a booking made for someone else', fdoc?.bookerName === 'Bilal Ahmed' && fdoc?.bookerPhone === '03001110003');
  const look = await call(null, 'GET', `/bookings/lookup?ref=${okF.data.ref}&phone=${encodeURIComponent('+44 7911 123456')}`);
  check('Find my booking works with a foreign number', look.status === 200 && !!look.data.token);
  const pubF = (await call(null, 'GET', `/hotels?city=${h.citySlug}&foreigners=1&limit=50`)).data;
  check('"Foreign guests welcome" filter finds the hotel', (pubF.items ?? []).some((x) => x._id === String(h._id)));
  if (fdoc) await call(owner, 'PATCH', `/bookings/${fdoc._id}/status`, { status: fdoc.status === 'pending' ? 'declined' : 'cancelled', note: 'test cleanup' });
  await hotels.updateOne({ _id: h._id }, { $set: { acceptsForeigners: '' } });

  /* ── Reviews ── */
  await reviews.deleteMany({ hotel: h._id, user: { $in: [(await users.findOne({ email: TEST_USERS.guest.email }))._id, (await users.findOne({ email: TEST_USERS.guest2.email }))._id] } });
  await bookings.updateMany({ hotel: h._id }, { $set: { reviewed: false } });
  const m1 = (await call(guest, 'GET', `/hotels/${h._id}/reviews/mine`)).data;
  check('Guest who stayed is recognised', m1.stayed === true && !m1.review);
  const r1 = await call(guest, 'PUT', `/hotels/${h._id}/reviews/mine`, { rating: 4, text: 'Clean rooms and helpful staff.', tripType: 'family', cleanliness: 5, country: 'gb' });
  check('Reviewer country is saved', r1.data?.review?.country === 'GB');
  check('Guest review goes live and is verified', r1.data?.status === 'approved' && r1.data?.review?.verified === true);
  const r2 = await call(guest2, 'PUT', `/hotels/${h._id}/reviews/mine`, { rating: 5, text: 'Call me on 0300 1234567 for discounts' });
  check('A review with a phone number waits for a check', r2.data?.status === 'pending');
  const r2b = await call(guest2, 'PUT', `/hotels/${h._id}/reviews/mine`, { rating: 5, text: 'Great location near the mall.' });
  check('Any signed-in account can review (not verified)', r2b.data?.status === 'approved' && r2b.data?.review?.verified === false);
  const own = await call(owner, 'PUT', `/hotels/${h._id}/reviews/mine`, { rating: 5 });
  check('Owner cannot review their own hotel', own.status === 403);
  const anon = await call(null, 'PUT', `/hotels/${h._id}/reviews/mine`, { rating: 5 });
  check('Signed-out visitors cannot review', anon.status === 401);
  const pubR = (await call(null, 'GET', `/hotels/${h._id}/reviews`)).data;
  check('Public list shows both, without account ids', pubR.items.length >= 2 && pubR.items.every((x) => !('user' in x) && !('booking' in x)));
  const hr = await hotels.findOne({ _id: h._id });
  check('Hotel rating recalculated', hr.ratingCount >= 2, `${hr.ratingAvg} from ${hr.ratingCount}`);
  const del = await call(guest2, 'DELETE', `/hotels/${h._id}/reviews/mine`);
  check('Reviewer can delete their review', del.status < 300);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed. Test hotel: ${h.name} (/hotels/${h.citySlug}/${h.slug})`);
  await mongo.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('ERROR', e);
  process.exit(2);
});
