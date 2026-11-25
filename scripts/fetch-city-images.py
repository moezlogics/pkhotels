"""
Downloads one freely licensed photo per city from Wikimedia Commons (the lead
image of the city's English Wikipedia article) into uploads/cities/, and
writes docs/image-credits.md with the source and licence of each.

    python scripts/fetch-city-images.py

Re-running skips cities that already have an image.
"""
import json, os, re, sys, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'uploads', 'cities')
UA = {'User-Agent': 'PakHotelsLocalDev/1.0 (city thumbnails for local testing)'}

# City -> Wikipedia article
CITIES = {
    'Lahore': 'Lahore', 'Karachi': 'Karachi', 'Islamabad': 'Islamabad', 'Rawalpindi': 'Rawalpindi',
    'Faisalabad': 'Faisalabad', 'Multan': 'Multan', 'Peshawar': 'Peshawar', 'Quetta': 'Quetta',
    'Gujranwala': 'Gujranwala', 'Sialkot': 'Sialkot', 'Hyderabad': 'Hyderabad, Pakistan', 'Bahawalpur': 'Bahawalpur',
    'Sargodha': 'Sargodha', 'Sahiwal': 'Sahiwal', 'Abbottabad': 'Abbottabad', 'Sukkur': 'Sukkur',
}


def get(url, tries=3):
    import time
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(8 * (i + 1))


def api(params):
    q = urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2})
    return json.loads(get(f'https://en.wikipedia.org/w/api.php?{q}'))


def commons_info(filename):
    q = urllib.parse.urlencode({'action': 'query', 'titles': f'File:{filename}', 'prop': 'imageinfo',
                                'iiprop': 'url|extmetadata', 'iiurlwidth': 900, 'format': 'json', 'formatversion': 2})
    d = json.loads(get(f'https://en.wikipedia.org/w/api.php?{q}'))
    page = d['query']['pages'][0]
    ii = (page.get('imageinfo') or [{}])[0]
    meta = ii.get('extmetadata', {})
    strip = lambda v: re.sub(r'<[^>]+>', '', (v or {}).get('value', '')).strip()
    return {
        'thumb': ii.get('thumburl') or ii.get('url'),
        'page': ii.get('descriptionurl'),
        'artist': strip(meta.get('Artist'))[:120],
        'license': strip(meta.get('LicenseShortName')),
    }


def main():
    os.makedirs(OUT, exist_ok=True)
    credits = []
    import time
    for city, article in CITIES.items():
        time.sleep(4)
        slug = re.sub(r'[^a-z0-9]+', '-', city.lower()).strip('-')
        dest = os.path.join(OUT, f'{slug}.jpg')
        try:
            d = api({'action': 'query', 'titles': article, 'prop': 'pageimages', 'piprop': 'name'})
            name = d['query']['pages'][0].get('pageimage')
            if not name:
                print('no image', city); continue
            info = commons_info(name)
            lic = info['license'] or ''
            if not re.search(r'CC|Public domain|PD|GFDL', lic, re.I):
                print('skip (licence)', city, lic); continue
            if not os.path.exists(dest):
                data = get(info['thumb'])
                open(dest, 'wb').write(data)
            credits.append(f"| {city} | [{name}]({info['page']}) | {info['artist'] or 'see source'} | {lic} |")
            print('ok', city, lic)
        except Exception as e:  # keep going for the other cities
            print('fail', city, e, file=sys.stderr)
    md = ['# Image credits', '', 'City photos in `uploads/cities/` (served at `/uploads/cities/<city>.jpg`),',
          'from Wikimedia Commons under the licences below.', '', '| City | File | Author | Licence |', '| --- | --- | --- | --- |', *credits, '']
    open(os.path.join(ROOT, 'docs', 'image-credits.md'), 'w', encoding='utf8').write('\n'.join(md))


if __name__ == '__main__':
    main()
