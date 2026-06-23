# Manual server deploy (no git) — fix blank page / ChunkLoadError

`ChunkLoadError` and `GET /_next/static/chunks/*.js 400` mean the **HTML and JS chunks are from different builds** (or `.next` is incomplete). This is a deploy process issue, not an app bug.

## Rules

1. **Never copy `.next` from your Windows PC to the server.** Always run `next build` on the Linux server.
2. **Never upload only `app/` files** without rebuilding — chunk file names change every build.
3. **Admin and web are separate apps** — each needs its own build and PM2 process on the correct port.
4. After every deploy: **hard refresh** (Ctrl+Shift+R) or use incognito.

## Ports (must match Nginx)

| Domain                      | App            | Port     |
| --------------------------- | -------------- | -------- |
| `reader.vidhyavibe.in`      | `apps/web`     | **1034** |
| `readeradmin.vidhyavibe.in` | `apps/admin`   | **3034** |
| `readerapi.vidhyavibe.in`   | `services/api` | **2034** |

## One-time PM2 setup

From repo root (`~/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine`):

```bash
# Reader (web)
pm2 delete reader 2>/dev/null || true
pm2 start pnpm --name reader --cwd apps/web -- start

# Admin
pm2 delete readeradmin 2>/dev/null || true
pm2 start pnpm --name readeradmin --cwd apps/admin -- start

# API (example — adjust to your existing command)
# pm2 start ... readerapi on port 2034

pm2 save
```

Verify ports:

```bash
pm2 show readeradmin | grep -E 'cwd|script'
ss -tlnp | grep -E '1034|3034'
```

`readeradmin` **cwd** must be `.../apps/admin`, not `apps/web`.

## ChunkLoadError / 400 on `/_next/static/chunks/*.js` (blank page)

The browser loads HTML but JS chunks return **400** → build is broken or missing on the server.

**Your build never finished** if you still see `EACCES` / `EPERM` in SSH. PM2 is serving an old or empty `.next` folder.

### Quick diagnosis (on server)

```bash
cd ~/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine
bash deployment/scripts/diagnose-static.sh
```

### Fix order (must complete ALL steps)

**A. As root** (separate SSH login — not vidhyavibe-reader):

```bash
PROJECT=/home/vidhyavibe-reader/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine
rm -rf "$PROJECT/node_modules" "$PROJECT/apps/"*/node_modules "$PROJECT/packages/"*/node_modules "$PROJECT/services/"*/node_modules
chown -R vidhyavibe-reader:vidhyavibe-reader "$PROJECT"
```

**B. As vidhyavibe-reader:**

```bash
cd ~/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine
pnpm install
rm -rf apps/admin/.next apps/web/.next
pnpm --filter apps-admin build
pnpm --filter apps-web build
pm2 restart readeradmin reader --update-env
```

**C. Verify before opening browser:**

```bash
ls apps/admin/.next/static/chunks/*.js | wc -l    # expect 50+
curl -sI http://127.0.0.1:3034/admin/login | head -1   # HTTP/1.1 200
curl -sI http://127.0.0.1:1034/login | head -1        # HTTP/1.1 200
```

**D. Browser:** hard refresh or incognito on `https://readeradmin.vidhyavibe.in/admin/login`

If `pnpm --filter apps-admin build` still fails, paste the **full build error** — do not restart PM2 until build succeeds.

## Admin chunk returns 400 even on localhost (127.0.0.1:3034)

**Symptom:**

```bash
curl -I http://127.0.0.1:3034/_next/static/chunks/webpack-....js   # 200 OK
curl -I http://127.0.0.1:3034/_next/static/chunks/650-....js       # 400 Bad Request
```

This is **not Nginx** — the Node process on 3034 is broken or is an **old zombie** (PM2 showed 50k+ restarts).

### Step 1 — Check chunk file exists on disk

```bash
cd ~/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine

ls -la apps/admin/.next/static/chunks/650-f5096496761832e2.js
ls -la apps/admin/.next/static/chunks/app/admin/login/page-c0d0a8871fe480ea.js
find apps/admin/.next -name '650-*'
```

If **missing** → rebuild:

```bash
rm -rf apps/admin/.next
pnpm --filter apps-admin build
```

### Step 2 — Kill zombie process on port 3034 (as root)

```bash
ss -tlnp | grep 3034
# Note the PID (e.g. 122117)

kill <PID>
# if still running:
kill -9 <PID>
```

### Step 3 — Start PM2 with ecosystem file (as vidhyavibe-reader)

Upload `deployment/ecosystem.config.cjs` to the server (uses `apps/admin/node_modules/next`, not root).

```bash
cd ~/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine

# Stop anything still holding ports (if curl fails after PM2 start)
ss -tlnp | grep -E '1034|3034'

pm2 delete reader readeradmin 2>/dev/null || true
pm2 start deployment/ecosystem.config.cjs
pm2 save

pm2 status
pm2 logs readeradmin --lines 20
ss -tlnp | grep -E '1034|3034'
```

If PM2 says `Script not found`, verify:

```bash
ls -la apps/admin/node_modules/next/dist/bin/next
ls -la apps/web/node_modules/next/dist/bin/next
```

Fallback without ecosystem file:

```bash
pm2 start pnpm --name readeradmin --cwd apps/admin -- start
pm2 start pnpm --name reader --cwd apps/web -- start
pm2 save
```

### Step 4 — Verify chunks return 200

Chunk **filenames change every build**. List actual files first:

```bash
ls apps/admin/.next/static/chunks/*.js | head -5
ls apps/admin/.next/static/chunks/app/admin/login/
```

Then test with a **real** filename from that list:

```bash
curl -sI http://127.0.0.1:3034/admin/login | head -1
curl -sI "http://127.0.0.1:3034/_next/static/chunks/$(ls apps/admin/.next/static/chunks/*.js | head -1 | xargs basename)" | head -1
```

### Step 5 — Reload Nginx (as root only)

```bash
/usr/sbin/nginx -t && systemctl reload nginx
```

(`vidhyavibe-reader` cannot run nginx — use root SSH.)

---

## Admin works on localhost but 400 on readeradmin.vidhyavibe.in (CloudPanel)

**Symptom:** `curl http://127.0.0.1:3034/...` → **200**, but browser on `https://readeradmin.vidhyavibe.in/_next/static/chunks/*.js` → **400**.

Build is fine. **Nginx / CloudPanel reverse proxy** for `readeradmin` is wrong.

### Diagnose on server

```bash
cd ~/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine
bash deployment/scripts/diagnose-static.sh

# Compare same chunk locally vs public:
curl -sI http://127.0.0.1:3034/_next/static/chunks/650-f5096496761832e2.js | head -1
curl -sI https://readeradmin.vidhyavibe.in/_next/static/chunks/650-f5096496761832e2.js | head -1

pm2 show readeradmin | grep -E 'cwd|status|restarts'
ss -tlnp | grep 3034
```

### Fix in CloudPanel

1. Open **CloudPanel** → **Sites** → site for **readeradmin.vidhyavibe.in**
2. **Reverse proxy** must target **`127.0.0.1:3034`** (admin), **not** `1034` (reader web)
3. Remove any custom rule that serves `/_next/` from disk (`alias` / `root` to `htdocs`)
4. All traffic (`/` including `/_next/`) must proxy to Node on **3034**

Correct Nginx pattern (CloudPanel → Vhost / Custom config):

```nginx
location / {
    proxy_pass http://127.0.0.1:3034;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

**Do not** add a separate `location /_next/` pointing at a folder on disk.

### Fix PM2 (readeradmin must use apps/admin + port 3034)

```bash
pm2 delete readeradmin
cd ~/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine
pm2 start pnpm --name readeradmin --cwd apps/admin -- start
pm2 save
```

`apps/admin/package.json` must have `"start": "next start -p 3034"`.

### After CloudPanel change

```bash
# As root, reload nginx (CloudPanel may do this automatically)
nginx -t && systemctl reload nginx

# Purge browser cache / test incognito
```

## If build fails with EACCES / EPERM (permission denied)

### Symptom

- `EACCES: permission denied` on `typescript.js`
- `EPERM: operation not permitted, chmod` on `prisma`
- `chown: ... Operation not permitted` when run as **vidhyavibe-reader**
- Paths like `prisma/query_engine-windows.dll.node` or `*.CMD` / `*.ps1` in `node_modules`

### Cause

1. **`node_modules` was copied from Windows** — must never be uploaded to Linux. Reinstall on the server.
2. Files are owned by **root** (FTP upload as root). Only **root** can `chown` or delete them.
3. Running `chown` as `vidhyavibe-reader` does **not** work — you need a **root SSH login** (separate session).

### Fix (run as **root** in a new SSH window)

```bash
PROJECT=/home/vidhyavibe-reader/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine

# Remove Windows node_modules (root can delete root-owned files)
rm -rf "$PROJECT/node_modules"
rm -rf "$PROJECT/apps/web/node_modules"
rm -rf "$PROJECT/apps/admin/node_modules"
rm -rf "$PROJECT/packages/config/node_modules"
rm -rf "$PROJECT/packages/ui/node_modules"
rm -rf "$PROJECT/packages/db/node_modules"
rm -rf "$PROJECT/services/api/node_modules"

# Fix ownership of entire project
chown -R vidhyavibe-reader:vidhyavibe-reader "$PROJECT"
```

### Then (as **vidhyavibe-reader**)

```bash
cd ~/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine

pnpm install
rm -rf apps/admin/.next
pnpm --filter apps-admin build
pm2 restart readeradmin --update-env
```

### Never upload to server

- `node_modules/` (any folder)
- `apps/*/.next/` from your PC
- Files from Windows builds

Upload **source code only**, then `pnpm install` + `pnpm build` on Linux.

**Do not** run `pm2 restart` until `pnpm --filter apps-admin build` ends with **✓ Compiled successfully**.

## Admin API 401 on upload ("Invalid or expired token")

Login works but `POST /api/admin/magazines` returns 401.

### Deploy all three (required)

**1. API** — add to server `.env` (repo root, same file API loads):

```env
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
```

Upload `services/api/src/middleware/auth.ts` and `packages/config/src/env.ts`, then:

```bash
pnpm --filter @magazine/config build
pm2 restart readerapi --update-env
```

**2. Admin** — upload `apps/admin/lib/upload.ts`, `lib/api.ts`, magazine pages, `scripts/next-api-rewrite-base.cjs`:

```bash
cd ~/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine
INTERNAL_API_URL=http://127.0.0.1:2034 pnpm --filter apps-admin build
pm2 restart readeradmin --update-env
```

`INTERNAL_API_URL` makes `/api` proxy to loopback (avoids HTTPS hop stripping `Authorization` on file uploads).

**3. Log in again** after deploy, then retry upload.

### Verify token in browser

DevTools → Network → failing POST → Request Headers must include:
`Authorization: Bearer ...` and `X-Access-Token: ...`

## Deploy admin only (after uploading source files)

**Important:** run every command from the **repo root** (folder that contains `package.json`).

```bash
# Switch user (if needed)
su - vidhyavibe-reader

# Go to project root — MUST do this first (prompt should NOT end with ~$)
cd ~/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine

# Confirm you are in the right place (must print package.json)
ls package.json apps/admin/package.json
pwd
# Expected: /home/vidhyavibe-reader/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine

# 1. Install deps (monorepo — run from root only)
pnpm install

# 2. Remove old build artifacts (important)
rm -rf apps/admin/.next

# 3. Build on server
pnpm --filter apps-admin build

# 4. Confirm chunks exist (should list many .js files)
ls -la apps/admin/.next/static/chunks/ | head

# 5. Restart
pm2 restart readeradmin --update-env

# 6. Smoke test from server
curl -sI http://127.0.0.1:3034/admin/login | head -5
```

Open `https://readeradmin.vidhyavibe.in/admin/login` in a **private window**.

## Deploy reader (web) only

```bash
cd ~/htdocs/reader.vidhyavibe.in/VidhyaVibe_Magazine
pnpm install
rm -rf apps/web/.next
pnpm --filter apps-web build
pm2 restart reader --update-env
```

## If chunks still return 400

1. **Wrong app on port** — `curl http://127.0.0.1:3034/admin/login` should return admin HTML with "Sign in to Your Admin".
2. **Nginx cache** — purge CDN / Hostinger cache if enabled.
3. **Mixed builds** — delete `.next` again, rebuild, restart PM2.
4. **Check a failing chunk on disk**:
   ```bash
   ls -la apps/admin/.next/static/chunks/7257-*.js
   ```
   If missing, build did not finish or you are serving the wrong directory.

## What to upload via FTP

Upload **source** (`apps/admin/app`, `components`, `lib`, etc.) — **not** `.next`.

Then SSH in and run the **Deploy admin only** steps above.
