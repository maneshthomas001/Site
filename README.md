# Manesh & Maji — A Celebration of Love

A lightweight, mobile-first wedding invitation in forest green, ivory, and gold. No framework, account, database, or runtime dependencies are needed for the public website.

## Publish on GitHub Pages

This project is configured for **maneshthomas001/Site**. Its intended address is **https://maneshthomas001.github.io/Site/**; that address becomes live only after GitHub completes deployment.

1. Put this repository's files on its `main` branch.
2. In GitHub, open **Settings → Pages → Build and deployment**, and choose **GitHub Actions** as the source.
3. Open **Actions → Deploy wedding invitation to GitHub Pages → Run workflow**. Future pushes to `main` deploy automatically.

The workflow installs the pinned dependencies, builds `dist/`, and deploys it with GitHub's official Pages actions. It reads the actual Pages base URL for sharing metadata and works under the `/Site/` subfolder. No personal token or secret needs adding to the repository. Upload repository source files, including the hidden `.github` folder; do not upload `node_modules` or test output.

To update the invitation permanently through GitHub, edit `content.json` or replace/add media in `public/media/`, then commit to `main`. The next deployment updates the public invitation. You can also use **Personalise → Export .zip** and host that static export independently.

Invitation details are embedded in the built HTML, so opening the page does not depend on a separate `content.json` request. Old or invalid browser drafts fall back to the published details. The public page does not need `structuredClone` or `ResizeObserver` support.

## Develop and check

Use the existing checkout at `/workspace/Site`. Each cloud task already has an isolated environment; do not create a worktree unless requested.

```sh
npm ci --cache /tmp/wedding-npm-cache
npm run dev
```

The development server listens on port 3000. `PORT=3001 npm run dev` changes the port. Node.js 20 or newer is required; this environment was prepared with Node.js 24.

```sh
npm run build
npm test
npm run preview
```

The build creates `dist/`. Tests build and exercise the actual static website in Chromium, including the opening, scratch reveal, calendar, countdown, editor, uploads, and ZIP export. Set `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`, or install Playwright's Chromium. Test browsers are development tools only.

## Personalise without coding

Open the invitation and choose **Personalise** in the footer, or use `?edit=1` on the website address.

- **Details:** names, date and time, time zone, venue, map, messages, headings, and finishing labels.
- **Photos:** add the original Manesh and Maji portraits, adjust their focal points, and add gallery photos and captions.
- **Music:** upload an MP3, M4A, WAV, or OGG file. MP3 or M4A is recommended across browsers. Music starts after a guest opens the invitation; the sound button pauses or resumes it.
- **Sharing:** enter the final public website address, edit the sharing description, and optionally choose a preview image.

**Save changes** stores a private draft and media in IndexedDB in that browser. It does not change repository files, publish, or update other visitors. Browser data may be cleared by the browser; keep original files and export a backup. Drafts are separated by website subfolder.

**Export .zip** downloads a standalone static website, including the current settings, optimised photographs, music, fonts, illustration assets, a regenerated social preview, and metadata. It exports the current form values even before saving. Extract it and upload every file and folder to any HTTPS static host. No build is required for the exported ZIP. To view the extracted files locally, serve the folder over HTTP; opening `index.html` directly through `file://` will block the content request.

This is a public invitation, not an authenticated content management system. The editor lets each visitor personalise their own browser copy; it cannot change the hosted website. Host access is needed to deploy an updated export.

## Personalise in the repository

All invitation details and copy are in `content.json`. Place media in `public/media/` and reference it with relative paths such as `media/manesh.webp`. Run `npm run build` and upload `dist/` to your static host. Local fonts, illustrations, and metadata are included in the build.

The wedding is configured for **10 November 2026, 12:30 PM in Asia/Kolkata (UTC+05:30)**. Both the countdown and calendar download use the precise timestamp. The countdown stops at zero and displays a celebration message after the wedding. The illustration of the church is decorative and does not depict the actual venue.

## Uploaded assets and publication status

The two photographs in the chat were visible as references but were not delivered as downloadable files to this workspace. No music file was available. Designed monogram artwork is used until the original photos are added; no substitute couple photographs or soundtrack are included. Add your originals through Personalise or `public/media/` before publication.

The repository includes automatic GitHub Pages deployment. A workflow file alone does not prove publication; check the completed Pages deployment in GitHub Actions before sharing the public address.

## WhatsApp preview

Set `siteUrl` to the final HTTPS address, including any subfolder, before building/exporting. Open Graph tags are rendered into static `index.html`, so crawlers do not need JavaScript. The default preview is a 1200 × 630 PNG; exports regenerate it with the current names, date, time, and venue. A custom image can be selected. The host must serve the page and preview image publicly over HTTPS. WhatsApp controls its preview cache, so browser-only edits do not update existing shared previews.

## Compatibility and privacy

The page supports touch and pointer scratching, an accessible reveal button, keyboard controls, reduced motion, lazy photo loading, and Safari image-decoding/encoding fallbacks. Chromium mobile emulation was tested; actual iPhone/Safari validation remains outstanding because the environment blocked the WebKit browser downloads with `403 Domain forbidden`. Music never autoplays before a gesture. No analytics, third-party scripts, external fonts, tracking, or remote image requests are included by default. Google Maps opens only when a guest chooses the venue button. User-provided remote media must support CORS to be packaged in an export; uploaded local files avoid that restriction.

Fonts are Cormorant Garamond and DM Sans under the SIL Open Font License. License files are in `public/fonts/` and included in exports.
