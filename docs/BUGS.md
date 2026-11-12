# Bug log

Every problem found while using or testing the app: what happened, why, and
how it was fixed. Newest first. Claude adds rows when a bug is found or fixed.

**How to write a good bug report:** what device and browser, what I did step by
step, what I expected, what actually happened (exact message), and any clues
(terminal lines, screenshots).

| # | Found | Bug | Status |
|---|---|---|---|
| 9 | 2026-11-12 | Hold to talk fails on iPhone | 🟡 fix ready, check on iPhone |
| 8 | 2026-11-12 | A spoken turn takes ~15 s (target 3 s) | 🟡 fix ready, measure on phone |
| 7 | 2026-11-12 | Laddu's voice switched to an English accent on his second line | 🟡 fix ready, listen on phone |
| 6 | 2026-11-12 | Scene background (sky, grass) missing in the real chat | ✅ fixed |
| 5 | 2026-11-12 | CI failing: test expected log rows in a fixed order | ✅ fixed |
| 4 | 2026-11-11 | Scorer changed my meaning words ("yesterday" → "today") | ✅ fixed |
| 3 | 2026-11-11 | Scorer gave the same sentence different scores; marked spelling as mistakes | ✅ fixed |
| 2 | 2026-11-10 | Scorer misread "samikiren" (meant *samaikkiren*, cooking) as worship/buying | 👀 watching |
| 1 | 2026-11-07 | Magic-link login says "expired" when opened in a different browser | 🟡 workaround |

## Details

### 9. Hold to talk fails on iPhone
- **Device:** iPhone, Safari, through the codespace address.
- **What I did:** tapped Laddu starts, held 🎤, talked, let go.
- **Expected:** my words appear and Laddu replies.
- **Happened:** "Aiyo, I couldn't hear that. Try again or type it." Every time.
- **Clues:** works on laptop Chrome. The server terminal shows **no `/talk`
  request from the phone**, so the recording fails on the phone before it's sent.
  Suspects: Safari's press-and-hold text-selection menu cutting the press short,
  the recording format, the mic start-up delay.
- **Why (found 2026-11-12):** the phone turned the recording away itself, as
  "silent". Two iPhone things: (1) the app had set Safari's audio to
  "playback" (so Laddu can be heard with the silent switch on), which can
  switch the microphone off; (2) while recording, iPhone can pause the audio
  engine the app used to measure loudness, so it measured nothing and decided
  I was silent.
- **Fix:** the audio switches to "play-and-record" while 🎤 is held, then back;
  a meter that hears nothing at all no longer counts as silence (the recording
  is sent and ElevenLabs decides); recording in one piece (no time slices);
  Safari's selection menu blocked on the whole mic area. A small grey code now
  shows under "couldn't hear that" (`quiet`, `short`, `mic-error:…`, `failed`,
  `silent`) so the next report says which step failed.

### 8. A spoken turn takes ~15 s
- **Happened:** `POST /talk` 13.4 s, then `GET /api/speech` 1.4 s. A typed turn
  (`/send`) took 11.6 s.
- **Why (likely):** every step runs one after another (hear → Tanglish rewrite →
  score → reply → voice), and Laddu waits for all of it.
- **Note:** the terminal's time for `/talk` and `/send` includes the score,
  which arrives last, so it's longer than the wait for Laddu.
- **Fix (2026-11-12):** Laddu writes his hidden Tamil-script line first (tutor
  prompt v4); the server starts his voice the moment that line is done and
  sends the phone a key, so he starts talking while his caption is still being
  written. For spoken turns he starts on what was heard straight away; my
  bubble text and score are made in the background and never hold him up. To
  check: the `api_calls` query in PLAN.md.

### 7. Laddu's accent changed
- **Happened:** Charlie's first line sounded great; the second had a strong
  English accent.
- **Likely why:** the voice guesses the language from the text. If it got
  Tanglish (English letters) instead of the hidden Tamil-script line, it read it
  as English. Fix: always send the Tamil-script line; set the language to Tamil
  where the voice model allows (ElevenLabs Flash can).

### 6. Scene background missing
- The approved draft had sky, grass and sun; the real chat didn't.
- **Why:** I built the full-body layout from the spec's wording instead of
  copying the approved draft (version 4).
- **Fixed:** the scene now matches the draft: cartoon background, bigger
  characters cut off at the waist, bubbles above each head.

### 5. CI failing on GitHub, passing in the codespace
- **Why:** two calls finishing at the same time can save their log rows in
  either order; one test expected a fixed order ("flaky test"). In the
  codespace the order happened to match.
- **Fixed:** the test accepts either order.

### 4. Scorer changed meaning words
- "Naethu naan cinema-ku poren" → it changed *naethu* (yesterday) to *innaiki*
  (today) instead of fixing the verb to *ponen*.
- **Fixed in scorer v2:** keep time words, fix the verb. v3: when I say what I
  meant, my meaning wins.

### 3. Scorer inconsistent and punished spelling
- Smoke eval v1: same message scored e.g. 9, 8, 10 (58% consistent, target 90%);
  *kudikren* and *saaptiya* marked as mistakes.
- **Fixed in scorer v2:** list mistakes first, then score from the list;
  spelling and short spoken forms are never mistakes → 100% consistent.

### 2. "samikiren" misread
- I meant *samaikkiren* (cooking). Laddu read it as worship, then as buying.
  This is what "That's not what I meant" is for. Candidate for the gold set.

### 1. Magic link "expired"
- The link only works in the browser that asked for it. Workaround: copy the
  link and open it in the same browser. Real fix planned: a 6-digit email code
  (around going live).
