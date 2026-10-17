# OldLunar Studio — Photobooth

A retro photo-strip photobooth that runs in the browser. Guests take four photos with
their camera, then customise the strip with filters, frames, backgrounds, decorations and
text, and download, print or share it. Photos stay on the device; the only thing uploaded
is a copy of a strip that someone chooses to share by QR code, and that copy expires after
24 hours.

Live site: https://oldlunarstudio-photobooth.vercel.app/

## Features

- **Classic booth** — pick a countdown (3–15 s), take four photos, reorder or retake any
  shot, then edit the strip.
- **PairSnap** — two people recreate four reference poses, one shot at a time.
- **PhotoPop** — choose a ready-made template and take one photo per frame.
- **Editor** — styles, frames, layouts, backgrounds, filters with strength, brightness,
  contrast and saturation, decorations and text.
- **Export** — high-resolution PNG download, print, and native share where the device
  supports it.
- **QR download** — creates a QR code that downloads the strip on any phone. Links last
  24 hours.
- **Camera** — front camera is mirrored (like a selfie mirror) for the preview and the
  saved photos; the rear camera is shown and saved as the lens sees it. Switching works
  on phones and on desktops with several webcams.

## Tech stack

- React 18 and Vite 7
- Tailwind CSS 4 (utilities) plus component stylesheets
- Font Awesome icons
- `qrcode` for QR generation
- `@vercel/blob` for private file storage of shared strips
- Hosted on Vercel, with serverless functions in `api/`

## Project structure

```
api/
  share.js              POST: stores a shared strip as a private Blob
  download/[name].js    GET: streams a shared strip back as a download (24 h)
  cleanup.js            GET: deletes expired strips (run daily by a Vercel cron job)
lib/
  strips.js             shared rules: file naming, 24-hour expiry
  cleanup.js            removes expired strips from Blob storage
src/
  App.jsx               top-level flow: landing → booth → session → editor
  components/           screens (camera, editor, session, landing, PairSnap, PhotoPop)
  hooks/                useCamera (camera + switching), useCapture (countdown + shots)
  utils/                canvas, export, filters, qr, shareLink, sounds, …
public/                 poses and photo-strip templates
vercel.json             cron schedule for cleanup
```

## Getting started (local development)

Requirements: Node.js 20 or newer, npm.

```bash
npm install
npm run dev
```

Open the address that Vite prints (usually http://localhost:5173). Camera access requires
a secure page, and `localhost` counts as secure.

The sharing (QR) feature needs the serverless functions, which only run on Vercel. Locally
you can still take photos, edit and download; the QR step will report that the download
service is not running at this address.

Other scripts:

```bash
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

## Environment variables

Set these in Vercel under **Project → Settings → Environment Variables**.

| Name | Required | What it does |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Yes, for QR sharing | Access token for the Blob store. Added automatically when the store is connected to the project. |
| `CRON_SECRET` | Yes, for the cleanup job | Secret that Vercel sends with the daily cleanup request. Requests without it are refused. |
| `VITE_SHARE_ENDPOINT` | No | Overrides the upload address (default `/api/share`). Leave unset on Vercel. |

Never commit these values to the repository.

## Setting up QR sharing on Vercel

Sharing stores each strip in a **private** Vercel Blob store and gives out a link that
expires after 24 hours.

1. In the Vercel dashboard, open **Storage → Create → Blob**.
2. Name the store (for example `oldlunar-strips`), choose a region, and select **Private**.
3. Open the store and click **Connect Project**. Select this project and tick **Production**
   (and **Preview** if you test there). This adds `BLOB_READ_WRITE_TOKEN`.
4. Check **Settings → Environment Variables** that `BLOB_READ_WRITE_TOKEN` is listed for
   Production.
5. Redeploy with **Use existing Build Cache** unticked. Environment variables apply only to
   deployments made after they are added.

To test the upload, run this from a folder that contains a JPEG named `test.jpg`:

```bash
curl -i -X POST https://oldlunarstudio-photobooth.vercel.app/api/share \
  -H "Content-Type: image/jpeg" --data-binary @test.jpg
```

A `201 Created` response with a `downloadUrl` means sharing works.

### Expiry cleanup

`vercel.json` runs `/api/cleanup` every day at 03:00 UTC. The function deletes strips past
their 24-hour window. Set `CRON_SECRET` first, or the cleanup request is refused. Download
links also stop working on time without waiting for cleanup, because the download route
checks the expiry itself.

## Troubleshooting

| Message or code | Cause | Fix |
| --- | --- | --- |
| "Sharing storage is not connected…" (`storage_not_connected`) | `BLOB_READ_WRITE_TOKEN` is missing on the live deployment | Connect the Blob store to the project, then redeploy without the build cache |
| `store_access_mismatch` | The Blob store is public, but the code uploads privately | Use a private store, as described above |
| "The server could not save the strip right now." | Server error during upload | Read the **Logs** for the deployment and filter for `share upload failed` |
| "This link has expired" | The strip is older than 24 hours | Create a new QR code from the editor |
| Camera says "busy" | Another app is using the camera | Close the other app and try again |
| Front camera looks mirrored | Expected: the selfie view is mirrored on purpose | Switch to the rear camera if you need the unmirrored view |

## Privacy

- Photos are processed in the browser. Nothing is uploaded unless someone taps to create a
  QR code.
- A shared strip is stored privately and is deleted after 24 hours.
- No accounts, no tracking, no ads.

## Licence

All rights reserved. Contact the project owner before reusing the code, artwork or
branding.
