# QR Code Reward System (standalone module)

Self-contained module: scan a purchase's QR code, pick which reward card it
counts toward, unlock one section of that grayscale image, celebrate at
100%. Each meal type has its own reward card - the customer, not staff,
decides at scan time which card a given purchase applies to, so a customer
can be building progress on several cards at once.

The customer-facing side is a plain mobile web page (`reward.html`) - the
printed QR is just a normal link, so any phone's default camera opens it
immediately with **no app install and no OS-level setup required**. A full
Flutter package is also included for later if you want a native app
experience instead, but it's entirely optional - the system is fully
functional with just the backend. Not wired into any other app - copy
`backend/` (and, optionally, `flutter_module/`) into your project.

## Layout

```
qr_reward_system/
  backend/           Node/Express + Prisma + SQLite API (source of truth for all validation)
  flutter_module/    Flutter package: scan screen, progress screen, widgets
```

## Backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:migrate   # creates dev.db and the 3 tables below
npm run prisma:seed      # seeds your 4 reward images (backend/public/reward-images)
npm run dev               # http://localhost:4000
```

### Database models (`prisma/schema.prisma`)

- **RewardImage** — id, name, imageUrl, totalSections, rows, cols, isActive, createdAt. One row per meal type / card design.
- **CustomerRewardProgress** — id, customerId, rewardImageId, unlockedSections (JSON array), completed, timestamps. Unique per `(customerId, rewardImageId)` — a customer gets one independent progress row per meal type.
- **PurchaseQrCode** — id, purchaseId (unique), customerId (nullable), rewardImageId (nullable), token (unique), status (`ACTIVE`/`USED`/`EXPIRED`), rewardProgressId, createdAt, usedAt. customerId and rewardImageId are both `null` until scanned — printed QRs are generic, not tied to any customer or meal yet.

To add a new meal's reward card, add a new `RewardImage` row with
`isActive: true` — it immediately shows up in the customer's post-scan
picker, no code changes.

### API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/purchases/qrcode` | Call right after an item/purchase is ready. Body: `{}`, or `{ "purchaseId": "..." }` if you already have an order id. No meal, no customer — both are picked later, by the customer, at scan time. Returns `{ purchaseId, token, status }`. Idempotent per purchaseId. |
| GET | `/api/qrcode/:token/image` | Renders a print-ready PNG (800x800, high error correction) encoding a plain link: `${APP_PUBLIC_BASE_URL}/reward.html?token=...`. Any phone camera opens this like any other link - no app needed. |
| GET | `/api/scan/:token` | Step 1 of scanning: read-only check that the code exists and is still `ACTIVE`. 404 / 409 otherwise. Doesn't consume anything - call this before showing the "which meal is this for?" picker. |
| GET | `/api/reward-images` | Lists active reward cards (id, name, imageUrl, rows, cols, totalSections) — this is the picker shown to the customer after step 1 succeeds. |
| POST | `/api/scan` | Step 2: called once the customer picks a card. Body: `{ "token": "...", "customerId": "...", "rewardImageId": 1 }` — customerId is the app's own logged-in user; rewardImageId is the customer's choice. This is the actual atomic claim + unlock. |
| GET | `/api/progress/:customerId` | `{ "progress": [...] }` — every reward card this customer has any progress on (one entry per meal type they've chosen so far), for a "my rewards" list. |

`POST /api/scan` is the only mutation a customer-facing client ever calls.
It:
1. Looks up the token; 404 if unknown.
2. Validates `rewardImageId` refers to a real, active card; 400 otherwise.
3. Atomically flips status `ACTIVE -> USED` and stamps both `customerId` and
   `rewardImageId` onto the row in the same `updateMany` (guarded by
   `status: 'ACTIVE'`), so a second concurrent claim of the same code — by
   anyone, picking any meal — affects 0 rows and is rejected with `409` /
   "This QR Code has already been used." Whoever's choice lands first is
   permanent; nothing about it can be changed afterward, including by a
   second request from the same customer.
4. Only after a successful claim does it unlock the next section on the
   chosen card for that customer.

### Integrating with your existing purchase flow

Your existing backend/checkout (or kitchen/POS) code just needs one HTTP
call per item — no meal, no customer, nothing to type:

```
POST /api/purchases/qrcode
{}
```

Print/display the returned `token` as a QR code (or hit
`/api/qrcode/:token/image` for a ready-made PNG) on the receipt/packaging.

### Printing a QR for a physical meal/order

Open `http://localhost:4000/print-label.html` — one button, no typing: click
it, a fresh generic QR appears, click print.

### The customer experience: `reward.html`

This is what the printed QR actually opens - a plain mobile web page, no
app required:

1. Loads `?token=...` from the URL, calls `GET /api/scan/:token` to confirm
   it's still valid.
2. If valid, shows the meal picker (`GET /api/reward-images`).
3. On a tap, calls `POST /api/scan` with a `customerId` generated once and
   stored in the browser's `localStorage` (so the same phone/browser keeps
   accumulating progress across visits - there's no login in this module,
   plug in your real auth later if you have one).
4. Renders the resulting card, colored sections and all, and a "شوف كل
   جوائزي" (see all my rewards) link that lists every card via
   `GET /api/progress/:customerId`.

Set `APP_PUBLIC_BASE_URL` in `backend/.env` to an address your customers'
phones can actually reach - your PC's Wi-Fi IP for local testing (e.g.
`http://192.168.x.x:4000`), or your real domain once you deploy the backend
somewhere public. `localhost` only ever works from the same machine running
the server.

`demo.html` at the backend root is a separate desktop-browser page for
walking through the same scan → pick a meal → unlock → reuse-blocked flow
without needing a second device at all.

## Flutter module (optional)

Not required to run the system - `reward.html` already gives customers the
full experience with zero app work. Use this only if you later want a
native app screen instead of the web page. `flutter_module/` is a normal
Flutter package. Either:
- add it as a path dependency in your app's `pubspec.yaml`:
  ```yaml
  dependencies:
    qr_reward_system:
      path: ../qr_reward_system/flutter_module
  ```
- or copy `flutter_module/lib/src/*` into your own app and adjust imports.

Usage:

```dart
final config = RewardConfig(
  apiBaseUrl: 'https://your-backend.example.com',
  getCustomerId: () => currentUser.id, // however your app tracks the customer
  deepLinkScheme: 'myrestaurant',       // must match backend/.env APP_DEEP_LINK_SCHEME
);

Navigator.push(context, MaterialPageRoute(
  builder: (_) => QrScanScreen(config: config),
));
```

- `QrScanScreen` — opens the camera (via `mobile_scanner`), scans, calls
  `checkToken`, and on success pushes `ChooseMealScreen`. On an already-used
  or unknown code it shows "This QR Code has already been used." (or "not
  found") and nothing else. Has a "My Rewards" button in the app bar for
  viewing all cards, not just the one just scanned.
- `ChooseMealScreen` — shown after a valid scan; lists the active reward
  cards for the customer to pick from, then performs the actual claim and
  pushes `RewardProgressScreen` for the card they picked.
- `MyRewardsScreen` — lists every card the customer has progress on (one
  per meal type they've picked so far); tap one to open it full-size in
  `RewardProgressScreen`.
- `RewardProgressScreen` — always shown one specific card (passed in, never
  fetched by guessing which one you mean) and renders `SectionedRewardImage`
  for it; shows `CompletionCelebration` (confetti + message) once that
  card's `completed` is true.
- `SectionedRewardImage` — pure display widget: grid of `rows x cols`,
  grayscale everywhere except the unlocked section indexes.
- `RewardDeepLinkService` — see below; handles a customer scanning the
  printed sticker with their regular camera app instead of `QrScanScreen`.

The frontend never computes or trusts progress on its own — every screen
just renders whatever the backend last returned.

## Optional upgrade: opening a native app instead of the web page

By default the QR just opens `reward.html` in the phone's browser - nothing
to configure, works everywhere. If you later build the native Flutter app
(see above) and want the *same* printed QR to open it directly instead of
the browser, the standard approach is Android App Links / iOS Universal
Links: once you own a real domain and host the backend there, you publish a
verification file (`assetlinks.json` / `apple-app-site-association`) proving
you control both the domain and the app, and the OS then opens the app
instead of the browser for that exact URL - falling back to the browser
automatically if the app isn't installed. No change to the QR content is
needed for this upgrade; it's purely domain + OS configuration once you're
ready for it, and the details are OS/hosting-provider specific enough that
they're out of scope here.

The Flutter module still ships `QrScanScreen` / `ChooseMealScreen` /
`RewardDeepLinkService` for this scenario (an in-app camera scanner is
useful regardless of how the app gets opened) - see
`flutter_module/example/lib/main.dart` for how they wire together. None of
it is required for the system to work today.

## Security notes

- QR payload is a link carrying the opaque `token` only — no progress data
  is ever encoded in the QR itself, and the linked page does nothing but
  render whatever `/api/scan` and `/api/progress` return.
- All validation (existence, ownership, single-use) happens in
  `backend/src/services/rewardService.js`; the Flutter client has no code
  path that can unlock a section without a successful `/api/scan` call.
- Single-use is enforced at the database layer via a conditional update, not
  a check-then-act in application code, so it's race-safe against replay
  attempts.
- `customerId` on `/api/scan` is trusted as whatever the client sends -
  `reward.html` generates a random id once and keeps it in `localStorage`,
  which identifies a *browser*, not a verified person. That's a reasonable
  default for a low-stakes rewards system (worst case someone loses progress
  by clearing their browser, or a determined person edits their own
  `localStorage` to relabel their own progress under a different id - they
  still can't touch anyone else's, since a token can only ever be claimed
  once regardless of who claims it). If you plug in real customer accounts
  later (native app with login, phone number, etc.), swap in an id derived
  server-side from that authenticated session instead of trusting the raw
  client field, before relying on this for anything higher-stakes.
- `rewardImageId` is a customer choice, not staff input, but it's still
  validated server-side against real, active `RewardImage` rows before the
  claim is allowed — a customer can only ever pick among cards you've
  actually published, never invent one.

## Adding a new meal's reward card later

Insert a new row into `RewardImage` (any `rows`/`cols`/`totalSections`
combination) with `isActive: true` — it shows up immediately in the
customer's post-scan picker (`GET /api/reward-images`). Existing customers'
progress on other cards is unaffected; a new `CustomerRewardProgress` row is
created lazily the first time someone picks that new card. Set
`isActive: false` to retire a card without deleting history — existing
progress keeps working, it just stops being offered as a choice for new
scans.
