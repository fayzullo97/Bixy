# Phase 1 — Foundation: authentication & data model

Everything else depends on having a signed-in user and a place to store
progress. Build this first.

### 8.8 Authentication
Sign-in is exclusively through **Telegram Login** — a student authorizes with their existing Telegram account in one tap; there's no separate username/password to create, and no other sign-up path in v1.

- **Requires a Telegram bot.** Telegram Login is built around a bot that represents the app — this isn't optional infrastructure, it's how the login flow identifies itself to the user. Telegram's own guidance: the bot's profile picture should match the app's logo and its name should make the connection obvious, since the student sees a confirmation box naming that bot when they log in — an unfamiliar bot name/photo makes people less likely to authorize. Created and configured via [@BotFather](https://t.me/botfather); registering the app's URL(s) there (Login Widget section) is what produces the Client ID and Client Secret the integration needs.
- **Integration: the Telegram Login library** (`Telegram.Login.init` / `.open` / `.auth`), per Telegram's current docs (https://core.telegram.org/bots/telegram-login — this replaced an older iframe-widget approach, now archived). Decided over building against Telegram's OpenID Connect endpoints directly: OIDC's main advantage is treating each provider generically, interchangeable with Google or GitHub behind the same plumbing — but Telegram is the only identity provider this app is ever using, not one of several, so that genericness buys nothing here. The library is also just less to build.
- **What the login grants access to is scope-based, requested explicitly at login time** — not everything comes back automatically:
  - `profile` — id, name, username, and a profile photo URL. This is the baseline scope this app needs.
  - `phone` — the student's verified phone number, gated behind separate user consent. Not clearly needed for anything in this PRD yet — pulling it just because it's available would be collecting more than the app uses (see §13).
  - `telegram:bot_access` — lets the same bot send the student a direct message after login. Decided against for v1: scope stays login-only, since there's no messaging feature in this PRD to use it for yet. Nothing about the bot itself changes if this gets added later — it's the same bot either way, just an additional scope requested at login, not a second bot.
- **What actually comes back, and what doesn't.** The `profile` scope returns: Telegram user ID, full name, username, and a profile photo URL (hosted on Telegram's own CDN — the app can hotlink or cache it, doesn't need to). **There is no birthday or date-of-birth field anywhere in Telegram's login data** — it isn't part of `profile`, `phone`, or any other scope. If date of birth matters for anything (it doesn't appear to, elsewhere in this PRD), it would have to be collected separately, directly from the student, not pulled from Telegram.
- **Server-side validation is mandatory, not optional.** The login returns a signed JWT (`id_token`, RS256 by default). The backend must independently verify it — check the signature against Telegram's public keys, confirm the issuer is Telegram and the audience matches this app's bot, and check it hasn't expired — before trusting anything in it. Skipping this step means trusting whatever the client claims, which defeats the point of using Telegram as the identity source.
- Sign-in is a separate, minimal screen shown before the board — it isn't part of the board's single-input interface (§11), it's a gate in front of it.
- The sign-in screen also collects the student's app language (§8.7) — English, Uzbek, or Russian — before the board loads, since narration generation afterward depends on knowing which language to speak in. Telegram's own login data doesn't carry a language preference, so this stays a separate step either way.
- Sign-out is a small, unobtrusive control, not a toolbar addition to the board itself — a quiet link, not a button competing with the single input.

Requirements:
- A signed-in session persists across page reloads within the browser, so the student isn't asked to sign in every visit.
- Progress records (§8.9) and variant-seen tracking (§9.2) key off the student's Telegram user ID — a real, durable identity, not a workaround. This also fully retires the earlier concern (§12) about manually-provisioned test credentials not scaling: any real Telegram account is a genuinely distinct student, with no per-tester setup needed.
- The name, username, and profile photo URL from the `profile` scope are stored against the student's record and usable within the app (e.g. a greeting, an avatar) — see §9.1 for where this lives.
- Signing out is explicit and doesn't delete any saved progress (§8.9).
- Telegram becomes the only way in — there's no fallback for a student without a Telegram account. That's a deliberate v1 bet, not an oversight; see §12 for the risk this carries and why it's judged acceptable for this market.

### 8.9 Progress saving
Progress — which topics are done, quiz scores, mastery status, and where the student is mid-lesson — needs to survive the student closing the tab.

The reliable way to do this is not a single save triggered right as the tab closes: that moment (the browser's `beforeunload` event) is well known to fail to fire consistently, especially on the mobile browsers this app's target persona actually uses (§4). Instead:

- Save incrementally, as the student moves through a lesson — after each beat finishes, after each check-in answer, and after the quiz completes — rather than saving once at the end.
- Treat closing the tab mid-lesson as the normal case to design for, not an edge case: whatever was last saved is exactly where the student picks back up.
- A best-effort save on tab close/hide is still worth having as a backstop (the `visibilitychange` or `pagehide` events behave more consistently than `beforeunload`, particularly on mobile), but it should never be the only save that happens.

Requirements:
- Progress is tied to the student's Telegram identity (§8.8) and stored in Supabase, not just in the browser, so it survives a cleared cache or signing in again on a different device.
- Returning to a topic left mid-lesson resumes from the last saved point rather than restarting from the first beat.

