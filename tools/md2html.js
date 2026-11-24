const fs = require('fs');
const path = require('path');
const [src, out] = process.argv.slice(2);
let md = fs.readFileSync(src, 'utf8').replace(/\r/g, '');

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inline(s) {
  let t = esc(s);
  const codes = [];
  t = t.replace(/`([^`]+)`/g, (m, a) => { codes.push(a); return '\u0000' + (codes.length - 1) + '\u0001'; });
  t = t.replace(/"([^"]*)"/g, '\u201c$1\u201d').replace(/'/g, '\u2019');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/&lt;((?:https?:\/\/)[^\s&]+)&gt;/g, '<a href="$1">$1</a>');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\u0000(\d+)\u0001/g, (m, n) => '<code>' + codes[n] + '</code>');
  return t;
}
const lines = md.split('\n');
const html = [];
let i = 0;
function isTableRow(s) { return /^\s*\|.*\|\s*$/.test(s); }
function isTableSep(s) { return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(s) && s.indexOf('-') >= 0; }
while (i < lines.length) {
  const line = lines[i];
  if (!line.trim()) { i++; continue; }
  if (/^```/.test(line)) {
    i++;
    const buf = [];
    while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
    i++;
    html.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
    continue;
  }
  const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
  if (img) { html.push('<p class="fig"><img src="' + img[2] + '" alt="' + esc(img[1]) + '"></p>'); i++; continue; }
  if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
    const cells = r => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    const head = cells(line);
    i += 2;
    const body = [];
    while (i < lines.length && isTableRow(lines[i])) { body.push(cells(lines[i])); i++; }
    let t = '<table><thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>';
    body.forEach(r => { t += '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>'; });
    t += '</tbody></table>';
    html.push(t);
    continue;
  }
  let h = line.match(/^(#{1,3})\s+(.*)$/);
  if (h) { html.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'); i++; continue; }
  if (/^<!--\s*page break\s*-->$/.test(line.trim())) { html.push('<div class="pb"></div>'); i++; continue; }
  if (/^---\s*$/.test(line)) { html.push('<hr>'); i++; continue; }
  if (/^\d+\.\s/.test(line)) {
    const items = [];
    while (i < lines.length && /^(\d+\.\s|\s{2,}\S)/.test(lines[i]) && lines[i].trim()) {
      if (/^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, '')); }
      else { items[items.length - 1] += ' ' + lines[i].trim(); }
      i++;
    }
    html.push('<ol>' + items.map(x => '<li>' + inline(x) + '</li>').join('') + '</ol>');
    continue;
  }
  if (/^-\s/.test(line)) {
    const items = [];
    while (i < lines.length && /^(\s*-\s|\s{2,}\S)/.test(lines[i]) && lines[i].trim()) {
      if (/^\s*-\s/.test(lines[i])) { items.push(lines[i].replace(/^\s*-\s/, '')); }
      else { items[items.length - 1] += ' ' + lines[i].trim(); }
      i++;
    }
    html.push('<ul>' + items.map(x => '<li>' + inline(x) + '</li>').join('') + '</ul>');
    continue;
  }
  const buf = [];
  while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|---\s*$|!\[|<!--)/.test(lines[i]) && !isTableRow(lines[i])) {
    buf.push(lines[i].trim()); i++;
  }
  const text = buf.join(' ');
  const cls = /^\*Figure/.test(text) ? ' class="cap"' : '';
  html.push('<p' + cls + '>' + inline(text) + '</p>');
}

const css = `
@page { size: A4; margin: 20mm 21mm 18mm 21mm; }
html { -webkit-print-color-adjust: exact; }
body { font: 11pt/1.46 "Times New Roman", "Songti SC", "SimSun", serif; color: #000; margin: 0; }
h1 { font-size: 15.5pt; margin: 2pt 0 6pt; text-align: center; page-break-after: avoid; }
h1 + p { text-align: center; margin: 0 0 16pt; }
h2 { font-size: 12.5pt; margin: 17pt 0 6pt; page-break-after: avoid; }
h3 { font-size: 11pt; margin: 12pt 0 3pt; page-break-after: avoid; }
p { margin: 0 0 6pt; }
p.cap { font-size: 9.2pt; font-style: italic; margin: -1pt 0 11pt; page-break-before: avoid; }
p.fig { margin: 8pt 0 4pt; page-break-inside: avoid; }
img { max-width: 100%; display: block; }
img[src*="dify-flow"] { width: 78%; margin: 0 auto; }
img[src*="dify-chat"] { width: 56%; margin: 0 auto; }
img[src*="web-app"] { width: 84%; margin: 0 auto; }
.pb { page-break-after: always; height: 0; }
strong { font-weight: bold; }
em { font-style: italic; }
code { font-family: Menlo, Consolas, monospace; font-size: 9.2pt; }
pre { background: #f6f6f4; border: 0.5pt solid #d8d8d8; padding: 6pt 8pt; margin: 3pt 0 10pt; page-break-inside: avoid; }
pre code { font-size: 8.4pt; line-height: 1.45; }
table { width: 100%; border-collapse: collapse; margin: 5pt 0 11pt; font-size: 9.2pt; }
th, td { border: 0.5pt solid #8c8c8c; padding: 3.5pt 5pt; vertical-align: top; text-align: left; }
th { background: #ececec; font-weight: bold; }
tr { page-break-inside: avoid; }
td { word-break: keep-all; }
ul, ol { margin: 0 0 8pt; padding-left: 18pt; }
li { margin: 0 0 3pt; }
hr { border: 0; border-top: 0.8pt solid #000; margin: 16pt 0 12pt; }
a { color: #1144aa; text-decoration: none; }
`;

const doc = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
  + '<title>Team submission</title><style>' + css + '</style></head><body>\n'
  + html.join('\n') + '\n</body></html>\n';
fs.writeFileSync(out, doc);
console.log(out, doc.length, 'bytes', html.length, 'blocks');
