# Figures for the team submission

Three of these are generated from the repository and can be rebuilt byte for byte.
Three are console captures that need the `cloud.dify.ai` login, so they are slots
until someone with the account fills them.

| file | how it was made | rebuild |
|---|---|---|
| `dify-flow.png` | the six-node Chatflow drawn from `dist/hkust-guide-chatgpt.dsl.yml`, rendered headless at 2x from a hand-written SVG | `node tools/make_dsl.js`, then re-render the SVG at 2x in headless Chrome |
| `dify-chat.png` | the published chat app at <https://udify.app/chat/ZAjpRIuJBp2fNQRk>, headless Chrome, 1440x620, no login needed | re-shoot any time |
| `web-app.png` | the app answering sample question 1 through a deep link, headless Chrome at 1440x900 | `python3 -m http.server 8765` then the URL below |
| `dify-canvas.png` | **to capture** | see below |
| `dify-code-node.png` | **to capture** | see below |
| `dify-llm-node.png` | **to capture** | see below |

## The two automated captures

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=1440,620 \
  --virtual-time-budget=20000 --screenshot=docs/screenshots/dify-chat.png \
  'https://udify.app/chat/ZAjpRIuJBp2fNQRk'

(python3 -m http.server 8765 &) && sleep 1.5
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=1440,900 \
  --virtual-time-budget=6000 --screenshot=docs/screenshots/web-app.png \
  'http://localhost:8765/?q=I%20am%20at%20the%20library%20entrance%2C%20how%20do%20I%20get%20to%20LG1%20canteen%3F&lang=en&sf=1'
pkill -f 'http.server 8765'
```

## The three console captures

All three are of the same app: Dify Cloud, Studio, the Chatflow titled
`HKUST Campus Guide (ChatGPT)`, imported from `dist/hkust-guide-chatgpt.dsl.yml`.
Take them at 100% zoom, in light theme, with the browser wider than 1400 px so
the node panels are not clipped.

1. **`dify-canvas.png`**: the whole canvas, all six nodes visible, titles legible
   (开始 start, 引擎 engine, 规则命中了吗, 路线 route, 前台 front desk, 兜底 reply).
2. **`dify-code-node.png`**: click 引擎 engine. The panel must show the input
   variable `query` = `{{#sys.query#}}`, the three declared outputs (String `text`,
   String `kind`, Boolean `ok`), and the first line of the code,
   `// Engine version: a2762b3892aa`. Crop to the panel.
3. **`dify-llm-node.png`**: click 前台 front desk. The panel must show
   `openai / gpt-5.6-sol`, temperature `0`, max tokens `240`, memory window off,
   context off, vision off. Crop to the panel.

If the hash in (2) is not `a2762b3892aa`, the console is running a different
build: re-import the DSL and rebuild with `node tools/bundle_engine.js`, then
`node tools/make_dsl.js`, which prints the new hash. Then update the hash in
`docs/TEAM_SUBMISSION.md`, section 2.4.

Drop the three files in this folder, re-run the print step, and they will appear
in the PDF:

```bash
node tools/md2html.js docs/TEAM_SUBMISSION.md docs/team-submission-print.html
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-gpu --no-pdf-header-footer --print-to-pdf=docs/Team-submission.pdf \
  "file://$PWD/docs/team-submission-print.html"
```

(Once they exist, add `![Figure 4](screenshots/dify-canvas.png)` and friends to
section 2.4 of `docs/TEAM_SUBMISSION.md` before the last command.)
