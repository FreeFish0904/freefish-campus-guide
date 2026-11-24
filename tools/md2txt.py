import re, textwrap, sys
src, out = sys.argv[1], sys.argv[2]
md = open(src, encoding='utf-8').read().split('\n')
res, incode, blank = [], False, False
buf = []

def flush():
    global buf
    if not buf:
        return
    text = ' '.join(buf)
    text = re.sub(r'\s+', ' ', text)
    res.extend(textwrap.wrap(text, 92, break_long_words=False, break_on_hyphens=False) or [''])
    res.append('')
    buf = []

def inline(s):
    s = s.replace('**', '').replace('`', '')
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1 (\2)', s)
    return s

for line in md:
    s = line.rstrip()
    if s.startswith('```'):
        incode = not incode
        continue
    if s.strip() == '<!-- page break -->':
        continue
    m = re.match(r'^!\[([^\]]*)\]\([^)]+\)$', s.strip())
    if m:
        flush(); res.append('[%s]' % m.group(1)); blank = False
        continue
    if incode:
        flush(); res.append('    ' + s); continue
    if s.strip().startswith('|'):
        flush()
        if re.match(r'^\|?[\s:|-]+\|[\s:|-]*$', s.strip()) and '-' in s:
            continue
        cells = [c.strip() for c in s.strip().strip('|').split('|')]
        res.append(' | '.join(inline(c) for c in cells)); blank = False
        continue
    if re.match(r'^#{1,6}\s', s):
        flush()
        lvl = len(s) - len(s.lstrip('#'))
        res.append(('' if lvl == 1 else '  ' * (lvl - 2)) + inline(s.lstrip('# '))); res.append(''); blank = True
        continue
    if not s.strip():
        flush()
        if not blank and res:
            res.append('')
        blank = True
        continue
    if re.match(r'^\s*([-*]|\d+\.)\s', s):
        flush()
        res.append(inline(s)); blank = False
        continue
    buf.append(inline(s))
flush()
txt = '\n'.join(res).strip() + '\n'
txt = re.sub(r'\n{3,}', '\n\n', txt)
open(out, 'w', encoding='utf-8').write(txt)
print(out, len(txt), 'chars', txt.count('\n') + 1, 'lines')
