# Social link preview image

Open Graph / X (Twitter) metadata in `src/app/layout.tsx` uses **`/brands/slotto-tickets.png`** (file: **`public/brands/slotto-tickets.png`**).

1. Keep that PNG in the repo and deploy it with the app (path is case-sensitive on some hosts).
2. For large previews, **1200×630** (or similar wide aspect) is ideal; square art still works but may crop in some clients.
3. Set **`NEXT_PUBLIC_SITE_URL`** (e.g. `https://slotto.gg`) in production so image URLs are absolute.

Refresh cached previews: [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/).
