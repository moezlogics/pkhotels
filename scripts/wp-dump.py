import json, sys, time, urllib.request, os
OUT = sys.argv[1]
BASE = 'https://pakhotels.pk/wp-json/wp/v2/'
UA = {'User-Agent': 'Mozilla/5.0 (pakhotels migration)'}
def get(url):
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode('utf-8')), r.headers
        except Exception as e:
            print('retry', url, e); time.sleep(2 + i * 3)
    raise SystemExit('failed ' + url)
def all_of(kind, extra=''):
    items, page = [], 1
    while True:
        data, h = get(f'{BASE}{kind}?per_page=100&page={page}{extra}')
        items += data
        total = int(h.get('X-WP-TotalPages', '1'))
        print(kind, 'page', page, '/', total, len(items))
        if page >= total: break
        page += 1
    return items
os.makedirs(OUT, exist_ok=True)
res = {}
for kind in ['hotel_location', 'hotel_feature', 'hotel_type', 'pages', 'posts', 'categories']:
    res[kind] = all_of(kind)
res['hotels'] = all_of('tf_hotel')
res['rooms'] = all_of('tf_room')
ids = set()
for h in res['hotels']:
    if h.get('featured_media'): ids.add(h['featured_media'])
    g = (h.get('tf_hotels_opt') or {}).get('gallery') or ''
    ids.update(int(x) for x in str(g).split(',') if x.strip().isdigit())
for r in res['rooms']:
    if r.get('featured_media'): ids.add(r['featured_media'])
    g = (r.get('tf_room_opt') or {}).get('gallery') or ''
    ids.update(int(x) for x in str(g).split(',') if x.strip().isdigit())
ids = sorted(ids); media = []
for i in range(0, len(ids), 100):
    chunk = ','.join(map(str, ids[i:i+100]))
    data, _ = get(f'{BASE}media?per_page=100&include={chunk}&_fields=id,source_url,alt_text,media_details,title')
    media += data; print('media', len(media), '/', len(ids))
res['media'] = media
json.dump(res, open(os.path.join(OUT, 'pakhotels-wp.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('DONE', {k: len(v) for k, v in res.items()})
