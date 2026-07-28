# VidhyaVibe Sale Page — Reference Only

The **production sales page** built from `salepagepromt.txt` lives in the main monorepo:

```
apps/web/app/sales/page.tsx
apps/web/components/sales/SalesLandingPage.tsx
apps/web/lib/salesPageConfig.ts
```

## Run the sales page (recommended)

From the **repo root** (`VidhyaVibe_Magazine`):

```bash
pnpm --filter apps-web dev
```

Open: **http://localhost:3000/sales**

Production URL: **https://reader.vidhyavibe.in/sales**

---

This `vidhyavibesale/` folder is a legacy Create React App scaffold. It is **not** used in production and has dependency conflicts with `react-scripts` 5. Use `apps/web` instead.

`salepagepromt.txt` in this folder is the design brief used to build the page in `apps/web`.
