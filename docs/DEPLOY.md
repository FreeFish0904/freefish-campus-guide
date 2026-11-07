# Deploying the demo (GitHub Pages)

**Status: published** — <https://freefish0904.github.io/freefish-campus-guide/>
(repo <https://github.com/FreeFish0904/freefish-campus-guide>, source
`main` / `/ (root)`). This page is kept as the record of how it was published
and what to do on the next update.

The whole site is static: `index.html`, `styles.css` and `src/`. No build
step, no server, no database, no API keys. Publishing it is either two git
commands (Route A) or a drag-and-drop job (Route B) — both end in the same
two mouse clicks on the Pages setting.

## Route A — push from this Mac (what we actually used)

The folder is a git repository with the history on `main`, and this Mac's SSH
key is authorised as **FreeFish0904**, so no password or token ever left the
machine.

1. Open <https://github.com/new>. Name: `freefish-campus-guide`. Visibility:
   **Public**. Do **not** tick "Add a README". Click **Create repository**.
2. Push:

   ```bash
   cd ~/Desktop/freefish-campus-guide
   git remote add origin git@github.com:FreeFish0904/freefish-campus-guide.git
   git push -u origin main
   ```

3. Turn on Pages — step 3 below (that one is a web click; there is no
   command-line equivalent without a personal access token).

## Route B — drag and drop in the browser

Use this if you would rather not touch git at all.

### 1. Create the repository

1. Sign in to <https://github.com> (create a free account if needed).
2. Click **+ → New repository**.
3. Repository name: `freefish-campus-guide`.
4. Set it to **Public** (Pages needs public, or a paid plan for private).
5. **Do not** tick "Add a README" — the folder already has one.
6. Click **Create repository**.

### 2. Upload the files

1. On the empty repository page click **uploading an existing file**
   (or **Add file → Upload files**).
2. Open the `freefish-campus-guide` folder on your computer.
3. Select **everything inside it** — `index.html`, `styles.css`, `README.md`,
   and the `src`, `docs` and `tests` folders — and drag it onto the page.
   The browser keeps the folder structure.
4. In the commit box type `Add campus guide prototype` and click
   **Commit changes**.
5. Wait until the file list appears. `index.html` must be at the **top
   level** of the repository, not inside another folder. If GitHub created
   a nested folder, open it, select all, and use **⋯ → Move** to lift the
   files up a level.

### 3. Turn on Pages

1. In the repository click **Settings** (top bar).
2. Choose **Pages** in the left sidebar.
3. Under *Build and deployment* → *Source*, pick **Deploy from a branch**.
4. Branch: **main**, folder: **/ (root)**. Click **Save**.
5. Wait about a minute, then reload the page. The link appears at the top:
   `https://<your-username>.github.io/freefish-campus-guide/`

Click **Visit site**. If you get a 404, wait another minute — the first
deployment is slow — then hard-refresh the page.

### 4. Check the live site

- The five cards appear above the input box.
- Typing a query (or tapping a card) draws a route on the floor plan.
- **Play walkthrough** switches floors by itself.
- The three language buttons re-translate the route already on screen.
- `…/index.html?q=hello&lang=zh` opens in Chinese.

### 5. Updating it later

Repeat step 2: **Add file → Upload files**, drag the changed files in, commit.
Pages redeploys in under a minute.

## When the live link answers 404

GitHub Pages shows two different 404 pages, and they mean different things:

| Page title | What it means | What to do |
|---|---|---|
| *Site not found* | There is no Pages site at that address at all - usually the project name is missing from the URL (`https://freefish0904.github.io/` instead of `.../freefish-campus-guide/`) | open `https://freefish0904.github.io/freefish-campus-guide/` |
| *Page not found - The site configured at this address does not contain the requested file* | The site **is** published, but that path has no file: a typo (`index.htm`), different capitalisation (`Freefish-Campus-Guide`, `Index.html`), a doubled project name, or a link copied while a deploy was still running | `404.html` in the repository root catches these and forwards to the app after a second, keeping `?q=` and `#` |

So a 404 for the app itself is almost never a broken deployment: check the
address bar first. `curl -s -o /dev/null -w '%{http_code}' <URL>` returning `200`
means the deployment is fine and the path was wrong. Pages also serves the
**previous** deploy while a new one builds, so a file added 20 seconds ago can
still 404 for a minute - reload, do not re-upload.

## Alternatives (if Pages is blocked)

- **Netlify Drop** — <https://app.netlify.com/drop>, drag the folder, get a
  URL instantly. No account needed for the first 24 hours.
- **Local** — `python3 -m http.server 8000` inside the project folder, then
  open <http://localhost:8000>. Opening `index.html` directly from Finder
  also works, because the app uses plain `<script>` tags (no ES modules).
