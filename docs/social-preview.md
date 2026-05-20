# Social link preview image

Open Graph / X (Twitter) metadata in `src/app/layout.tsx` uses **`/og.png`** (file: **`public/og.png`**).

1. Export your artwork as PNG. **1200×630** is ideal for large previews.
2. Save as **`public/og.png`** and deploy.
3. Set **`NEXT_PUBLIC_SITE_URL`** (e.g. `https://slotto.gg`) in production so image URLs are absolute.

Refresh cached previews: [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/).
