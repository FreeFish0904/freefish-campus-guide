#!/usr/bin/env python3
"""
Run the browser-side checks in headless Chrome, plus the Dify bundle check.

    python3 tests/browser_check.py

  node tests/check_bundle.js   dist/dify-engine.js is current, sandbox-safe
                               and answers exactly like the browser build
  tests/smoke.html         drives the real UI (21 checks, both campuses)
  tests/layout_check.html  measures every label on every floor (?data=demo
                           and ?data=ust), 0 collisions required
  tests/font_check.html    every printable character has a text-font glyph,
                           and no icon is a font glyph

The three pages write their verdict into <pre id="RESULT">, so this script
reads the DOM back instead of needing a driver library. file:// iframes are
same-origin only with --allow-file-access-from-files, which is why it is
passed here and worth remembering when running the pages by hand.
"""

import html
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = os.environ.get(
    'CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
FLAGS = [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--allow-file-access-from-files', '--window-size=1400,1000',
]


def load(page, query='', budget=30000, tries=3):
    # Read a page's verdict back out of <pre id="RESULT">. Headless Chrome
    # occasionally comes up without running the page at all (cold start,
    # profile lock); that is a flake in the runner, not a failed check, so a
    # missing result is retried once before it gets reported.
    url = 'file://' + os.path.join(ROOT, page) + query
    for _ in range(tries):
        # A throwaway profile per run: two headless Chromes sharing the
        # default profile hand the second one an empty page (the "profile
        # lock" flake), which looked like a failing check.
        profile = tempfile.mkdtemp(prefix='fust-chrome-')
        try:
            out = subprocess.run(
                [CHROME] + FLAGS + ['--user-data-dir=' + profile,
                                    '--virtual-time-budget=%d' % budget,
                                    '--dump-dom', url],
                capture_output=True, text=True).stdout
        finally:
            shutil.rmtree(profile, ignore_errors=True)
        m = re.search(r'<pre id="RESULT">(.*?)</pre>', out, re.S)
        if not m:
            continue
        txt = html.unescape(re.sub(r'<[^>]+>', '', m.group(1))).strip()
        if txt and not txt.startswith('running'):
            return txt
    return None


def main():
    if not os.path.exists(CHROME):
        print('Chrome not found at ' + CHROME)
        print('Set CHROME=/path/to/chrome and try again.')
        return 1

    failed = 0

    bundle = subprocess.run(['node', 'tests/check_bundle.js'], cwd=ROOT,
                            capture_output=True, text=True)
    lines = [l for l in bundle.stdout.strip().splitlines() if l]
    print('check_bundle.js: ' + (lines[-1] if lines else 'NO OUTPUT'))
    if bundle.returncode != 0:
        failed += 1
        for l in lines:
            if l.startswith('FAIL'):
                print('  ' + l)
        if bundle.stderr.strip():
            print('  ' + bundle.stderr.strip().splitlines()[-1])

    smoke = load('tests/smoke.html')
    print('smoke.html: ' + (smoke.splitlines()[0] if smoke else 'NO RESULT'))
    if not smoke or ' 0 failed' not in smoke.splitlines()[0]:
        failed += 1

    font = load('tests/font_check.html')
    head = [l for l in (font or '').splitlines() if l.startswith('DOM checks')]
    print('font_check: ' + (head[0] if head else 'NO RESULT'))
    if not head or ' problems: 0' not in head[0] or not font.startswith('font stack'):
        failed += 1
        for l in (font or 'NO RESULT').splitlines():
            if l.startswith('FAIL'):
                print('  ' + l)

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
