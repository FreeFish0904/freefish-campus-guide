#!/usr/bin/env python3
"""
Regenerate the screenshots in docs/screenshots/.

    python3 tests/screenshots.py

Uses headless Chrome (macOS path by default, override with CHROME=...).
Headless Chrome refuses to go narrower than ~500 CSS px, so the phone shot
renders index.html inside tests/phone.html (a real 390x844 iframe) and
crops the result.
"""

import os
import subprocess
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'screenshots')
CHROME = os.environ.get(
    'CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')

SHOTS = [
    {
        'file': 'desktop-en.png',
        'size': (1440, 900),
        'query': {
            'q': "I'm at the library entrance, how do I get to the LG1 Canteen?",
            'lang': 'en',
            'data': 'ust',
        },
    },
    {
        'file': 'desktop-skybridge.png',
        'size': (1440, 900),
        'query': {
            'q': 'How do I get from the Piazza to the bus stop?',
            'lang': 'en',
            'floor': 'G',
            'data': 'ust',
        },
    },
    {
        'file': 'desktop-zh.png',
        'size': (1440, 900),
        'query': {
            'q': '我在图书馆入口，怎么去 LG1 食堂？',
            'lang': 'zh',
            'data': 'ust',
        },
    },
    {
        'file': 'desktop-fastest.png',
        'size': (1440, 900),
        'query': {
            'q': 'Fastest way from the LG7 canteen to LT-A?',
            'lang': 'en',
            'sf': '0',
            'data': 'ust',
        },
    },
    {
        'file': 'desktop-tasks.png',
        'size': (1440, 900),
        'query': {
            'q': '',
            'lang': 'en',
            'data': 'ust',
            'tasks': '1',
        },
    },
    {
        'file': 'mobile-390.png',
        'size': (500, 880),
        'page': 'tests/phone.html',
        'crop': (780, 1688),
        'query': {
            'q': '我在图书馆入口，怎么去 LG1 食堂？',
            'lang': 'zh',
            'data': 'ust',
        },
    },
]


def url_for(shot):
    page = os.path.join(ROOT, shot.get('page', 'index.html'))
    return 'file://' + page + '?' + urllib.parse.urlencode(shot['query'])


def shoot(shot):
    out = os.path.join(OUT, shot['file'])
    w, h = shot['size']
    cmd = [
        CHROME,
        '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
        '--force-device-scale-factor=2',
        '--window-size=%d,%d' % (w, h),
        '--virtual-time-budget=6000',
        '--screenshot=' + out,
        url_for(shot),
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if not os.path.exists(out):
        print('  FAILED  ' + shot['file'])
        return False
    if shot.get('crop'):
        try:
            from PIL import Image
            im = Image.open(out)
            cw, ch = shot['crop']
            im.crop((0, 0, cw, ch)).save(out)
        except ImportError:
            print('  (Pillow not installed - left the phone shot uncropped)')
    print('  %-24s %s' % (shot['file'], os.path.relpath(out, ROOT)))
    return True


def main():
    if not os.path.exists(CHROME):
        print('Chrome not found at ' + CHROME)
        print('Set CHROME=/path/to/chrome and try again.')
        return 1
    os.makedirs(OUT, exist_ok=True)
    print('Writing screenshots to docs/screenshots/')
    ok = all(shoot(s) for s in SHOTS)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
