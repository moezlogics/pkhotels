#!/usr/bin/env bash
# PakHotels — build and (re)start the live site. Run as the site user from the
# project folder, every time you deploy:
#
#   cd /home/pakhotelspk/htdocs/pakhotels.pk && bash deploy/deploy.sh
#
# First time? Run the database setup once before this:  npm run db:import
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ── Checks ─────────────────────────────────────────────────────────────────
[ -f apps/api/.env ] || die "apps/api/.env is missing — copy it from your PC first (see DEPLOY.md)."
[ -f apps/web/.env ] || die "apps/web/.env is missing — copy it from your PC first (the build reads it)."
grep -q '^MONGODB_URI=mongodb://' apps/api/.env || die "apps/api/.env has no MONGODB_URI."
command -v node >/dev/null || die "Node.js is not installed for this user (CloudPanel → Node.js site uses nvm)."
command -v pm2 >/dev/null || { say "Installing PM2"; npm install -g pm2; }
[ -d uploads ] || echo "Note: no uploads/ folder yet — photos will be missing until you upload it."

# ── Code ───────────────────────────────────────────────────────────────────
if [ -d .git ]; then
  say "Pulling the latest code"
  git pull --ff-only
fi

say "Installing packages"
npm ci --no-audit --no-fund

# IndexNow (Bing/Yandex) checks https://pakhotels.pk/<key>.txt holds the key.
KEY=$(grep -E '^NEXT_PUBLIC_INDEXNOW_KEY=' apps/web/.env | cut -d= -f2- | tr -d '"'"'"' \r')
if [ -n "$KEY" ]; then
  rm -f apps/web/public/[0-9a-f]*.txt
  printf '%s' "$KEY" > "apps/web/public/${KEY}.txt"
fi

say "Building (a few minutes)"
NODE_OPTIONS=--max-old-space-size=6144 npm run build

# ── Run ────────────────────────────────────────────────────────────────────
say "Starting with PM2"
FIRST=0
if pm2 describe pakhotels-api >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  FIRST=1
  pm2 start ecosystem.config.js
fi
pm2 save

# First deploy: the API was not running while the website was built, so the
# static pages fell back to built-in text. Build the website once more now.
if [ "$FIRST" = 1 ]; then
  say "First deploy: rebuilding the website now that the API is up"
  for i in $(seq 1 40); do curl -fsS -o /dev/null http://127.0.0.1:3120/api/hotels/cities && break; sleep 3; done
  NODE_OPTIONS=--max-old-space-size=6144 npm run build --workspace=apps/web
  pm2 reload pakhotels-web --update-env
fi

say "Checking"
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3120/api/hotels/cities; then API=ok; break; fi
  sleep 3
done
WEB=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3119/ || true)
echo "API (3120):     ${API:-not answering — run: pm2 logs pakhotels-api}"
echo "Website (3119): ${WEB}"
echo
echo "Done. Open https://pakhotels.pk"
