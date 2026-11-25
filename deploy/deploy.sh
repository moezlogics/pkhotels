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

# The API goes first: the website's build reads pages (about, contact, blog…)
# from it, so it must already be answering on 3120 when the website builds.
# Both builds still run through turbo from the root (shared packages first).
export NODE_OPTIONS=--max-old-space-size=6144

# Starts a PM2 app, or reloads it when it is already running.
up() {
  if pm2 describe "$1" >/dev/null 2>&1; then
    pm2 reload "$1" --update-env
  else
    pm2 start ecosystem.config.js --only "$1"
  fi
}

say "Building the API"
npx turbo run build --filter=api...

say "Starting the API (port 3120)"
up pakhotels-api
API=""
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null http://127.0.0.1:3120/api/hotels/cities; then API=ok; break; fi
  sleep 3
done
[ "$API" = ok ] || die "The API did not start on 3120 — see: pm2 logs pakhotels-api --lines 50"
echo "API is answering."

say "Building the website (a few minutes)"
npx turbo run build --filter=web...

say "Starting the website (port 3119)"
up pakhotels-web
pm2 save

say "Checking"
WEB=""
for i in $(seq 1 20); do
  WEB=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3119/ || true)
  [ "$WEB" = 200 ] && break
  sleep 3
done
echo "API (3120):     ok"
echo "Website (3119): ${WEB} $( [ "$WEB" = 200 ] || echo '— see: pm2 logs pakhotels-web --lines 50')"
echo
echo "Done. Open https://pakhotels.pk"
