# Zono Index — V2

Private personal internet archive + identity hub.

## Imported library
- URL records: 642
- Duplicates preserved: yes
- Adult/private resources preserved: yes
- Games preserved: yes
- Social accounts preserved as Account records: yes
- Auto-categorized records: 642

## Categories
- Design & UI/UX: 137
- Development: 128
- Shopping & Lifestyle: 83
- AI & Automation: 57
- Games & Interactive: 48
- Education & Learning: 33
- Private Vault: 29
- Entertainment & Streaming: 29
- Accounts: 23
- Assets & Media: 19
- Business & References: 12
- Productivity: 11
- Social Platforms: 10
- Work & Freelance: 9
- Research & Reading: 8
- Utilities & Downloads: 4
- Short Links & Review: 2

## V2 changes
- Entire imported library auto-categorized.
- No duplicate is removed automatically.
- Add Link checks the whole library before saving.
- Add Account checks the whole library before saving.
- Notes are available when adding both links and accounts.
- Resource cards use category accents and clickable embedded URL labels.
- Social account cards use platform-specific brand colors and Simple Icons logos, with an offline text fallback.
- Private/adult entries are treated as normal data records and do not break rendering.
- Games and interactive links have their own category.
- Opaque shortened URLs are placed in `Short Links & Review` rather than guessed.

## Data behavior
This build uses new V2 localStorage keys, so it starts with the newly categorized seed data. The original uploaded text file is never modified.

## Run
Open `index.html`, or run:
```bash
python -m http.server 8080
```


## V3 additions
- Duplicate detection runs dynamically across the entire library.
- Manual **Scan duplicates now** action added.
- **Categorize uncategorized links** action repairs blank / legacy categories.
- Startup also assigns categories to uncategorized resource records where a confident rule exists.
- Bulk importer supports:
  - CSV
  - XLS
  - XLSX
  - pasted links
- Recommended bulk columns: URL, Title, Category, Tags, Notes, Type.
- Blank categories receive automatic category suggestions.
- Bulk import detects:
  - duplicates already in the library
  - duplicate rows within the current import
  - invalid URLs
- Duplicate rows are previewed before import and skipped by default.
- Existing records are never silently deleted or overwritten.
- Excel parsing loads SheetJS from jsDelivr; CSV and pasted-link import do not depend on it.


## V5 refinement
- Replaced oversized typography with a compact Satoshi-based type system.
- Reduced font weights; most headings now use 400–500 instead of heavy bold.
- Top navigation is fixed and no longer disappears when scrolling the library.
- Sidebar is fixed independently from content scrolling.
- Resource, account, category, stats and maintenance cards are substantially smaller and denser.
- Category palette changed from saturated colors to muted, low-saturation accents.
- Social account icons are now local inline SVG lettermarks, so no account card depends on Simple Icons loading.
- Added IndexedDB (`zono-index-db`) as the actual persistent local browser database.
- Existing localStorage data is migrated/hydrated into IndexedDB and retained as a compatibility cache.
- Reset now clears both localStorage and IndexedDB.


## V6 — full product architecture restored
Implemented as real screens:
- Library
- Discovery Feed
- Workbench
- Collections
- Private Vault
- Rediscover
- Random

### Library
Items now support `category`, `subcategory`, `theme`, `tags`, `notes`, collections, and Workbench pinning.

### Workbench
Resources with `pinned=true` appear here.

### Collections
Create purpose-based collections and assign resources through the Manage dialog.

### Private Vault
`Private Vault` category is excluded from Discovery and Rediscover by default and hidden behind an in-session reveal control.

### Rediscover
Uses `lastOpenedAt` / `createdAt` to surface old resources.

### Random
Supports category filtering and opt-in inclusion of the vault.

## Supabase
`supabase-schema.sql` is included.

The Cloud screen accepts:
- Supabase project URL
- browser-safe anon/publishable key

Do **not** put a service-role key in frontend code.

After running the schema in Supabase:
1. Open Cloud.
2. Enter project URL and anon/publishable key.
3. Test the connection.
4. Push local data to cloud.
5. Future local changes debounce-sync to Supabase while IndexedDB remains the offline fallback.

The included RLS policies are development policies for a private personal project. Replace them with authenticated user-scoped policies before publishing the app publicly.


## V7 — live Supabase database connected
- Live project URL: `https://scsfdktyemkosnhtwbqp.supabase.co`
- Uses the browser-safe Supabase publishable key.
- Service-role/secret keys are not included.
- Database tables are protected with per-user Row Level Security.
- Anonymous access to link data is revoked.
- Cloud screen now has email/password sign-up and sign-in.
- After sign-in, use **Push local → Supabase** to migrate the current local archive.
- IndexedDB remains the offline fallback.

Important: the 642 seeded URL records are not inserted into Supabase until an authenticated owner account exists, because secure RLS requires a real `auth.uid()` owner.


## V8 — Bagpack SaaS UI
- Renamed Zono Index to **Bagpack**.
- Pure black visual system; removed the blue library/background treatment.
- Rebuilt resource, account, category, collection, and discovery cards.
- Added restrained category palette and status pills inspired by the supplied reference:
  Pending, In progress, Submitted, In review, Success, Failed, Expired.
- Added website cover previews for normal links using lazy screenshot images with local visual fallback.
- Private Vault links do not send their URLs to the screenshot service.
- Added embedded live preview dialog (sites that block iframe embedding can still be opened externally).
- Added Library sorting/filtering:
  category, type, status, Workbench/favorite, newest/oldest, A–Z/Z–A, recently opened, most opened, domain.
- Added **Notes** workspace with:
  rich plain-text writing area, tags, colors, pinning, search, copy/paste, and multi-file TXT/Markdown import.
- Notes sync to Supabase and remain in IndexedDB offline.
- Added status and cover_url columns to resources; added secure notes table with user-owned RLS.
- Replaced navigation glyphs with consistent local inline line icons.
- Reduced card sizes, font weights, and large headings across the interface.

## V8.1 structural hotfix
- Fixed malformed Overview hero closing tags that corrupted the DOM tree.
- Removed a stale duplicate Cloud/Supabase panel that rendered outside its page.
- Verified all 13 application views are direct siblings under `<main>`.
- Verified there are no duplicate HTML IDs after repair.
- Preserved the 642-record packaged seed. No duplicates are automatically deleted or restored.
- Renamed remaining stale "Add to Index" wording to Bagpack.

## V8.2 layout and cards
- Reduced the large dead space between the fixed topbar and every page heading.
- Fixed Notes empty/editor visibility conflict.
- Notes now supports immediate typing plus a writing toolbar for headings, bold, italic, bullets, checklists, quotes, inline code, and links.
- Normal resource cards now follow the supplied reference: cover image, heading, short description/domain, primary action.
- Compact mode now follows the supplied horizontal reference card and renders in 3 columns on large screens, 2 columns on medium screens, and 1 on narrow screens instead of stretching full width.
- Tightened Rediscover, Workbench, Vault, Random, account, collection, and category layouts.

## V8.3 active status + account branding
- Added `Active` as a first-class resource status and made it the default.
- Migrated the live Supabase `resources` table to `active`.
- Added a one-time local browser migration that changes all currently stored resource/account statuses to Active without repeatedly overwriting later user choices.
- Replaced plain Add/Edit status selects with a custom icon/color status picker.
- Account cards now include platform-branded cover panels using the official platform brand color language and built-in brand marks, without relying on external icon CDNs.

## V8.4 notifications and motion
- Added Bagpack SVG favicon and browser theme color.
- Replaced the basic toast with a stacked notification system supporting success, info, warning, and error states.
- Added progress timers, dismiss buttons, and animated notification entry/exit.
- Added consistent motion tokens and transitions across navigation, cards, dialogs, status pickers, covers, and page changes.
- Added reduced-motion accessibility support.
- Improved Notes with Markdown-style formatting toolbar, preview mode, undo/redo, word count, character count, autosave feedback, keyboard shortcuts, and richer preview rendering.

## V8.5 favicon and social logos
- Added a complete Bagpack browser icon set: favicon.ico, 16px/32px PNG favicons, and Apple touch icon.
- Browser tabs no longer rely on SVG favicon support alone.
- Social account cards use Font Awesome Brands official platform logo glyphs for supported services.
- Includes graceful built-in fallback marks for services without a Font Awesome brand icon.

## V9 — stabilization and product hardening
- Removed Random and Rediscover from navigation and page rendering.
- Replaced the layered CSS patch stack with one consolidated theme-aware stylesheet.
- Added icon-only light/dark theme control with persistent preference.
- Added enhanced custom dropdown UI for ordinary selects.
- Added an app PIN gate and a separate Vault PIN challenge. PIN is `1102`.
- Added Local-only Vault mode; when enabled, Vault resources are excluded from Supabase push/pull.
- Added JSON backup, CSV export, JSON restore, and an undo snapshot before Reset.
- Added cloud deletion for resources/notes and collection cleanup.
- Relaxed the Supabase canonical-URL uniqueness constraint so intentional duplicates can sync.
- Added the missing collection_items UPDATE RLS policy and made `active` the database status default.
- Added pagination (48 items/page), reducing screenshot requests and DOM load.
- Added authenticated dead-link checks through the Supabase `check-link` Edge Function.
- Added PWA manifest, install icons, service worker, offline app-shell caching, and screenshot runtime caching.
- Added safer iframe preview scheme validation (http/https only).
- Stopped screenshot generation for account URLs and Vault URLs.
- Replaced the arbitrary health percentage with clear issue counts.
- Removed external Satoshi font loading and uses a robust system font stack.
- Pinned external library versions (SheetJS 0.18.5, supabase-js 2.49.1, marked 15.0.7, DOMPurify 3.2.6, Font Awesome 6.7.2).
- Supporting concerns are split into `js/config.js`, `js/security.js`, `js/backup.js`, `js/ui.js`, and `js/pwa.js`; `app.js` remains the core renderer/store while the monolith is being reduced safely.

## V9.1 unresponsive hotfix
- Fixed a recursive custom-dropdown render loop that could freeze the browser before/after the PIN gate.
- `refreshSelects()` now updates dropdown visuals without firing synthetic `change` events.
- Library rendering no longer recursively re-enters the dropdown refresh layer.
- No data, Supabase schema, PIN, theme, backup, or library features were removed.

## V9.2 cards and dialog polish
- Fixed the Edit Item dialog header so the eyebrow and title no longer collide.
- Polished select/dropdown triggers and reduced the heavy chevron feel.
- Redesigned resource cards to follow the provided reference: cover, heading, short description, and primary action.
- Redesigned compact cards to follow the compact reference item style.
- Redesigned social account cards into a tall profile-card layout inspired by the provided account reference.

## V9.3 notes and account profile images
- Removed Discovery from navigation and page rendering.
- Fixed resource cards so notes render only once; domain is the subheading and the note is the description.
- Added profile-picture upload to Add Account and Edit Item; account images become the profile-style card cover.
- Redesigned Notes into full-color modern cards so changing a note color tints the whole card.

## V9.4 exact social profile card
- Reworked social account cards to match the provided tall profile-card direction more closely.
- Removed extra platform/manage details from account cards.
- Account cards now show only the image, name, short bio, two small stats, and a rounded Follow CTA.

## V9.5 compact presentation and status audit
- Resource cards only display cover, item name, Open, Details (three dots), and Edit (pencil). Details modal contains full metadata.
- Account cards fit five across at desktop widths, with truthful opens/collection counts and dedicated Details/Edit icons.
- One-time local/IndexedDB/cloud-pull audit sets all statuses Active and repairs clearly inconsistent account categories.
- Does not delete duplicates or guess opaque short-link categories.

## V9.6 Details controls and button finish
- Replaced footer Close text with an accessible icon button in Record Details; standardized dialog X icons.
- Updated Library Open actions to a low-saturation navy-blue gradient with hover/focus states in both themes.
- Cloud project connection verified separately; private table access remains authenticated and cannot be unlocked by the publicly shipped four-digit PIN.

## V9.8 — Subcategories and practical dashboards
- All packaged records receive a deterministic subcategory based on their category, domain, title and note.
- Existing browser/cloud entries with blank subcategories are filled in without replacing manually chosen values.
- Home adds Quick Actions, Category Overview, Needs Attention, and Workspace dashboards.
- Duplicate review adds search, responsive comparison groups and a stronger empty state; manual deletion safety remains unchanged.
- Files: `subcategory-rules.js` and `SUBCATEGORY_AUDIT.json`.

## Uploaded image fix
- Image input changes now update the image preview before saving.
- Editing an existing account clears stale file selections and shows its current cover.
- Saving a new photo correctly replaces the prior cover image.
- Uploaded photos are resized to a maximum of 1000px and JPEG compressed to reduce storage failures.
- IndexedDB remains the full local storage source; localStorage gracefully omits embedded photos if its quota is exceeded.
- URL-based covers are still supported.
