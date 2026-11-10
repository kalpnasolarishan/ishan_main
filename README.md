# Kalpna Docs - browser version (nothing stored)

Open index.html from a web address (it will not work by double-clicking the file; the browser blocks it). Everything runs on the
visitor's device: the customer's details, signature and e-stamp photo are never sent anywhere and never saved.

## Put it online
Upload these to a new repository (or any static host): index.html, app.js, pdf-lib.min.js, rupee.js and the assets folder.
- GitHub Pages: repository > Settings > Pages > Deploy from a branch > main > / (root). The site appears at https://<you>.github.io/<repo>/
- Cloudflare Pages or Netlify: create a project, upload the same folder. (GitHub's rules do not allow its free Pages for a business
  running software as a service, so use one of these if you will sell or rent it. Check each host's current terms.)

## Do NOT put these in the repository (a public site shows every file to everyone)
Your seal image, your signature image, your bank details, partner phone numbers. The page asks for them in "Setup" and keeps them on
the device only (if you tick "Remember"). Default is: forget everything when the page is closed.

## Use
1. Setup (once per device): choose your seal PNG and your signature PNG, type bank details and partners, Save.
2. Fill the customer, let the customer sign in the box, choose the e-stamp photo.
3. The preview regenerates 0.6 s after every change. Download each PDF, or tick several and "Join ticked into one PDF".
4. Seals, signatures and details can be switched on/off in Setup (for example no sign at the bottom of the last page).

## Signature
Either sign on the screen, or choose "Use a photo of the signature" (dark ink on plain white paper). The page removes the paper
background and shows a preview on a checkerboard; the slider adjusts it. The photo never leaves the device.

## Download several documents
Tick the documents, then "one by one" (separate PDFs, one after another; your browser may ask permission to download several files)
or "as one ZIP" (separate PDFs inside a ZIP). "Join" makes a single PDF if you want one.

## Not included (needs saved data): customer list, payments ledger, file checklist, backups, licence lock.
