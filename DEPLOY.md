# PakHotels — live server par deploy

| Cheez | Value |
| --- | --- |
| Domain | `pakhotels.pk` |
| Folder | `/home/pakhotelspk/htdocs/pakhotels.pk` |
| Site user | `pakhotelspk` |
| Website port | **3119** (CloudPanel isi par domain bhejta hai) |
| API port | **3120** (sirf `127.0.0.1` par — bahar se band; website `/api`, `/uploads`, `/img` khud aage bhejti hai) |
| Database | MongoDB `pakhotels`, user `pakhotels` (script khud banata hai) |

## Aap ke PC se server par kya jayega

| PC (`C:\Users\xomoe\propertydealer\pakhotels.pk\…`) | Server (`/home/pakhotelspk/htdocs/pakhotels.pk/…`) | Kaise |
| --- | --- | --- |
| poora code | same folder | `git clone` / `git pull` |
| `deploy/seed/pakhotels-seed.json.gz` (hotels, rooms, cities, plans…) | same | git ke saath khud aata hai |
| `apps/api/.env` | `apps/api/.env` | **khud copy karein** (git mein nahi) |
| `apps/web/.env` | `apps/web/.env` | **khud copy karein** (git mein nahi) |
| `uploads/` (photos) | `uploads/` | **khud upload karein** |

`.env` files mein asli, naye secrets hain: database password, JWT keys, admin login. Inhe kisi ko na bhejein aur git mein na daalein (`.gitignore` pehle se rokta hai). Database password wahi hai jo setup script MongoDB mein banata hai — `MONGODB_URI` se parhta hai, alag se kahin type nahi karna.

**Dashboard login:** `apps/api/.env` mein `ADMIN_EMAIL` aur `ADMIN_PASSWORD`. Pehli dafa login ke liye yeh password apne PC wali file se dekh lein (server par setup ke baad yeh file se mita diya jata hai). Login ke baad Dashboard → Account se password badal sakte hain.

---

## Pehli dafa (ek hi baar)

### 1. Server par zaroori cheezein (root se, ek dafa)

**MongoDB** (agar pehle se nahi hai — check: `systemctl status mongod`):

```bash
# Ubuntu 22.04/24.04 — MongoDB 7
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update && apt install -y mongodb-org
systemctl enable --now mongod
```

### 2. CloudPanel mein site

1. **Add Site → Create a Node.js Site**
   - Domain: `pakhotels.pk`
   - Node.js version: **22**
   - App Port: **3119**
   - Site user: `pakhotelspk`
2. **SSL/TLS → Actions → New Let's Encrypt Certificate** (`pakhotels.pk` aur `www.pakhotels.pk`).
   Cloudflare use kar rahe hain to SSL mode **Full (strict)** rakhein.

Koi extra Nginx rule nahi chahiye — `/api`, `/uploads`, `/img` website khud API (3120) ko bhejti hai.

### 3. Code, `.env` aur photos (site user se)

```bash
ssh pakhotelspk@SERVER_IP
cd /home/pakhotelspk/htdocs/pakhotels.pk
# CloudPanel ka folder khali na ho to bhi chalega: pehle alag jagah clone, phir yahan copy.
git clone https://github.com/moezlogics/pkhotels.git /tmp/pkhotels
cp -a /tmp/pkhotels/. . && rm -rf /tmp/pkhotels
```

Ab apne PC se teen cheezein upload karein (FileZilla / CloudPanel File Manager / `scp`):

- `apps/api/.env` → `/home/pakhotelspk/htdocs/pakhotels.pk/apps/api/.env`
- `apps/web/.env` → `/home/pakhotelspk/htdocs/pakhotels.pk/apps/web/.env`
- `uploads/` (poora folder) → `/home/pakhotelspk/htdocs/pakhotels.pk/uploads/`

`scp` se (PC ke PowerShell mein, project folder se):

```powershell
scp apps/api/.env pakhotelspk@SERVER_IP:/home/pakhotelspk/htdocs/pakhotels.pk/apps/api/.env
scp apps/web/.env pakhotelspk@SERVER_IP:/home/pakhotelspk/htdocs/pakhotels.pk/apps/web/.env
```

### 4. Packages aur database (ek command)

```bash
cd /home/pakhotelspk/htdocs/pakhotels.pk
npm ci
npm run db:import
```

`db:import` khud:

1. MongoDB mein user **`pakhotels`** banata hai, `.env` wale password ke saath, sirf `pakhotels` database ki ijazat ke saath.
2. Database **`pakhotels`** banata hai aur saara content daalta hai: 166 hotels, 511 room types, 18 cities, 86 areas, 3 plans, boost prices.
3. Dashboard admin banata hai (`ADMIN_EMAIL` / `ADMIN_PASSWORD`), phir server ki `.env` se password mita deta hai.
4. Dono `.env` files ko lock kar deta hai (sirf owner parh sakta hai).

Agar MongoDB par pehle se password laga hai ("requires authentication" aaye), to yeh command **root** se chalayein — script thori der ke liye auth band karke user banata hai aur phir bilkul pehle jaisa chalu kar deta hai:

```bash
sudo env "PATH=$PATH" npm run db:import
```

(Ya admin login maloom ho to: `npm run db:import -- --admin-uri 'mongodb://ADMIN:PASS@127.0.0.1:27017/?authSource=admin'`.)

Pehle dekhna ho ke kya karega, kuch badle baghair: `npm run db:import -- --dry-run`.

### 5. Build aur start

```bash
bash deploy/deploy.sh
```

Yeh packages install karta hai, phir **pehle API** build karke chalu karta hai (`pakhotels-api`, 3120), us ke jawab dene ka intezar karta hai, phir **website** build karke chalu karta hai (`pakhotels-web`, 3119) — is tarah website ke pages build ke waqt hi asli data se bante hain. Aakhir mein check karke batata hai.

> Build ke dauran `Fetch Failed … ECONNREFUSED 127.0.0.1:3120` dikhe to iska matlab hai API us waqt chal nahi rahi thi (jaise `npm run build` khud chalane par). Yeh error build nahi rokta; `bash deploy/deploy.sh` se chalayein to aayega hi nahi.

Server reboot ke baad bhi chalta rahe — ek dafa:

```bash
pm2 startup        # jo command yeh print kare, woh root se chala dein
pm2 save
```

Ab https://pakhotels.pk kholein. Login: https://pakhotels.pk/login

### 6. Live hone ke baad (dashboard se)

- **Payment Methods:** apne bank / JazzCash / Easypaisa accounts daalein — boost aur commission invoices par yahi dikhte hain.
- **Billing → Terms:** due days, WhatsApp number.
- **Settings → General:** phone, WhatsApp, email, social links, Google Search Console verification.
- Search Console mein `https://pakhotels.pk/sitemap.xml` submit karein.

---

## Har update par

PC par code badla, commit + push kiya, phir server par:

```bash
cd /home/pakhotelspk/htdocs/pakhotels.pk
bash deploy/deploy.sh
```

(`git pull`, install, build aur PM2 reload sab yahi karta hai.)

**Database ko dobara import na karein** — live bookings aur accounts wahan hain. Script waise bhi mana kar deta hai. Sirf content (hotels/rooms) dobara laana ho to `npm run db:import -- --replace` (accounts aur bookings ko haath nahi lagata).

PC par hotels ka content badal kar naya seed banana ho: `npm run db:export` → commit → push.

---

## Mushkil ho to

```bash
pm2 status
pm2 logs pakhotels-api --lines 50
pm2 logs pakhotels-web --lines 50
curl -s http://127.0.0.1:3120/api/hotels/cities | head -c 200     # API
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3119/   # website: 200
```

| Masla | Hal |
| --- | --- |
| `Authentication failed` (API logs) | `apps/api/.env` ka `MONGODB_URI` badla gaya? `npm run db:import` dobara chalayein — password ko `.env` ke mutabiq kar dega. |
| Photos nahi dikhti | `uploads/` folder `/home/pakhotelspk/htdocs/pakhotels.pk/uploads` mein hai? |
| 502 Bad Gateway | `pm2 status` — `pakhotels-web` chal raha hai? CloudPanel mein App Port 3119 hai? |
| Build "out of memory" | Server par kam se kam 4 GB RAM / swap chahiye. |

## Baad mein (optional)

- **Google sign-in:** Google Cloud mein OAuth client (`https://pakhotels.pk`, callback `https://pakhotels.pk/api/auth/google/callback`), ID aur secret `apps/api/.env` mein, phir `pm2 restart pakhotels-api`.
- **Discord alerts** (nayi booking/payment): channel webhook URL `DISCORD_WEBHOOK_URL` mein.
- **Redis cache:** Redis install ho to `REDIS_ENABLED=true`.
- **MongoDB par password lock:** `/etc/mongod.conf` mein `security:\n  authorization: enabled`, phir `systemctl restart mongod`. `pakhotels` user pehle se hai, site chalti rahegi. Pehle apna MongoDB admin user bana lein.
