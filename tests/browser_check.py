#!/usr/bin/env python3
"""
Run the two browser-side checks in headless Chrome.

    python3 tests/browser_check.py

  tests/smoke.html         drives the real UI (21 checks, both campuses)
  tests/layout_check.html  measures every label on every floor (?data=demo
                           and ?data=ust), 0 collisions required

Both pages write their verdict into <pre id="RESULT">, so this script reads
the DOM back instead of needing a driver library. file:// iframes are
same-origin only with --allow-file-access-from-files, which is why it is
passed here and worth remembering when running the pages by hand.
"""

import html
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = os.environ.get(
    'CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
FLAGS = [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--allow-file-access-from-files', '--window-size=1400,1000',
]


def load(page, query='', budget=30000):
    url = 'file://' + os.path.join(ROOT, page) + query
    out = subprocess.run(
        [CHROME] + FLAGS + ['--virtual-time-budget=%d' % budget, '--dump-dom', url],
        capture_output=True, text=True).stdout
    m = re.search(r'<pre id="RESULT">(.*?)</pre>', out, re.S)
    if not m:
        return None
    return html.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip()


def main():
    if not os.path.exists(CHROME):
        print('Chrome not found at ' + CHROME)
        print('Set CHROME=/path/to/chrome and try again.')
        return 1

    failed = 0

    smoke = load('tests/smoke.html')
    print('smoke.html: ' + (smoke.splitlines()[0] if smoke else 'NO RESULT'))
    if not smoke or ' 0 failed' not in smoke.splitlines()[0]:
        failed += 1

    for data in ['demo', 'ust']:
        txt = load('tests/layout_check.html', '?data=' + data)
        head = [l for l in (txt or '').splitlines() if l.startswith('renders checked')]
        problems = [l for l in (txt or '').splitlines() if l.startswith('FAIL')]
        print('layout_check ' + data + ': ' + (head[0] if head else 'NO RESULT'))
        if not head or problems:
            failed += 1
            for p in problems[:10]:
                print('  ' + p)

    print('\n' + ('BROWSER OK' if failed == 0 else str(failed) + ' CHECK(S) FAILED'))
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
