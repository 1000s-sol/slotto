# Social link preview image

Open Graph / X (Twitter) metadata in `src/app/layout.tsx` uses **`/og.png`** (file: **`public/og.png`**).

The repo includes a **generated** `public/og.png` sized for link previews. Replace it with your **own exported PNG** anytime so the embed matches your final brand asset exactly (recommended **1200×630** for large previews).

1. Export your artwork as PNG. **1200×630** is ideal for large previews.
2. Overwrite **`public/og.png`** and deploy.
3. Set **`NEXT_PUBLIC_SITE_URL`** (e.g. `https://slotto.gg`) in production so image URLs are absolute.

Refresh cached previews: [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/).
