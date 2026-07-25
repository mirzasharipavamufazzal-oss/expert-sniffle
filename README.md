# Learn & Earn — English Quiz Telegram Mini App

A Telegram bot + Mini App for English learners. Users pick a CEFR level (A1–C1),
answer multiple-choice quiz questions, and earn **10 coins per correct answer**.
Coins and progress are saved per user.

## What's included

```
learn-and-earn-bot/
├── bot.js              # Telegram bot (sends the "Open app" button)
├── server.js            # API + serves the mini app
├── db.js                 # Simple file-based storage for coins/progress
├── data/
│   ├── questions.json     # 10 questions per level, A1 → C1 (50 total)
│   └── users.json          # created automatically at runtime
├── public/
│   ├── index.html            # Mini app screens
│   ├── style.css               # Design system
│   └── app.js                    # Mini app logic (Telegram WebApp SDK)
├── package.json
└── .env.example
```

## How it works

1. User messages the bot and taps **Open Learn & Earn** — this opens the mini
   app inside Telegram.
2. The app shows a level path (A1 → C1). The user can pick **any** level, in
   any order.
3. Each level has 10 questions. Answering correctly for the first time awards
   10 coins; retrying an already-correct question won't double-pay coins
   (prevents farming).
4. Coins and per-level progress persist per Telegram user ID.

## Setup

### 1. Create your bot
1. Open Telegram, message **@BotFather**.
2. Send `/newbot`, follow the prompts, and copy the token it gives you.
3. Send `/mybots` → select your bot → **Bot Settings** → **Menu Button** (or
   use `/setmenubutton`) so you can attach the mini app URL later — you can
   also just rely on the `/start` button the bot sends, which already works
   without this step.

### 2. Install dependencies
```bash
cd learn-and-earn-bot
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```
Fill in:
- `BOT_TOKEN` — from BotFather
- `WEBAPP_URL` — the public HTTPS URL where you'll host this app (see below)

### 4. Deploy the web app (server.js + public/)
Telegram Mini Apps **must be served over HTTPS** — localhost won't work from
inside the Telegram client. Easiest free/cheap options:
- **Railway** or **Render**: connect the repo, set `BOT_TOKEN`/`WEBAPP_URL` as
  environment variables, deploy. You'll get an HTTPS URL automatically.
- **Fly.io** or a VPS with a reverse proxy (Caddy/Nginx) + Let's Encrypt also work.

Once deployed, set `WEBAPP_URL` in `.env` to that HTTPS URL (e.g.
`https://learn-and-earn.up.railway.app`).

### 5. Run the bot
Locally, or on the same host as the server:
```bash
npm run bot      # starts bot.js (long polling)
npm start        # starts server.js (the mini app + API)
```
In production you'd typically run both as separate processes (e.g. two
services on Railway/Render, or two PM2 processes on a VPS).

### 6. Test it
Message your bot on Telegram, tap **Open Learn & Earn**, pick a level, and
answer a few questions — your coin count should tick up by 10 per correct
answer.

## Customizing

- **Add/edit questions**: edit `data/questions.json`. Each entry is
  `{ "q": "...", "options": [...], "answer": <index of correct option> }`.
- **Change coin value**: `COINS_PER_CORRECT` in `server.js`.
- **Add more levels or a leaderboard UI**: `/api/leaderboard` already returns
  the top 20 users by coins — just wire up a screen in `app.js` to display it.
- **Swap storage**: `db.js` uses a JSON file, fine for small/medium user
  counts. For scale, swap it for SQLite or Postgres — the rest of the app
  only calls `getUser`, `saveUser`, `addCoins`, `readAll`, so the interface
  stays the same.

## Notes on security

`server.js` verifies Telegram's `initData` signature (HMAC with your bot
token) so a request really came from your bot's mini app and wasn't spoofed
via browser devtools. This only works once `BOT_TOKEN` is set and the app is
opened from inside Telegram — when testing the `public/` files directly in a
browser, it falls back to a random local dev ID stored in `localStorage` so
you can still click through the flow.
