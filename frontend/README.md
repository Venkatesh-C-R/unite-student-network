# UNITE website

The React + Vite + Tailwind website for UNITE. It needs the API in [`../backend`](../backend/README.md) running on port 4000; the dev server passes every `/api` request to it. See the [main README](../README.md) for the full setup.

## Commands

```bash
npm install     # once
npm run dev     # website on http://localhost:5173
npm run build   # production files in dist/
npm run lint    # oxlint
```

## Where things are

- `src/pages/`: one file per screen (landing page, unions, claims, flyers, leaderboard, review, admin)
- `src/components/`: landing-page sections; `src/components/app/` holds the parts shared by the signed-in screens
- `src/lib/`: small helpers (button styles, formatting, programme labels)
- `src/api.js`: the one function that talks to the API
- `src/data.js`: text and tables for the landing page
- `public/downloads/`: the documents offered on the landing page
