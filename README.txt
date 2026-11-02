INJANDA TRADING — online shop (Supabase edition)

1) ONE-TIME DATABASE SETUP
   Supabase dashboard -> SQL Editor -> New query -> paste supabase-setup.sql -> Run.
   (config.js already contains your project URL and anon key.)

2) RUN
   Open this folder in VS Code, install "Live Server", right-click index.html ->
   "Open with Live Server".  Any device that opens the site shares the same data.
   On the first visit the catalogue products are written to Supabase automatically.

3) ADMIN
   Click the faint dot after "All rights reserved." in the footer (or press Ctrl+Shift+A),
   log in with username 123 / password 123, then change it in Settings.

4) YOUR OWN PRODUCTS
   Admin > Products > "Delete all products" removes the catalogue items,
   "+ Add product" creates yours (upload photos from your computer — stored in Supabase Storage).
   Price 0 = "Request a quote".  Blank stock = not tracked.

5) IMAGES (Admin > Products > Edit, or Admin > Banners)
   - Copy any picture (screenshot, browser, Word...) and press Ctrl+V while the form is open, or drag a file onto the picture box.
   - "Enhance" lets you tune sharpness, brightness, contrast and framing (square / fit on white) before saving.
   - Photos are resized with step-down scaling and sharpened automatically; small photos are enlarged smoothly.

6) STOCK
   Admin > Products > "Add stock": receive / remove / set an exact count, with a note and a movement history.
   Orders and cancellations update stock automatically.  Low-stock level: Settings > Low-stock alert.

Files: index.html, style.css, app.js (shop), admin.js (back office), data.js (starter
catalogue), config.js (Supabase keys), supabase-setup.sql, img/ (catalogue photos),
img-data.js (backup copy of photos, loaded only if a file in img/ is missing).
