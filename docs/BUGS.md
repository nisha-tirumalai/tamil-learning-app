# Bug log

Every problem found while using or testing the app: what happened, why, and
how it was fixed. Newest first. Claude adds rows when a bug is found or fixed.

**How to write a good bug report:** what device and browser, what I did step by
step, what I expected, what actually happened (exact message), and any clues
(terminal lines, screenshots).

| # | Found | Bug | Status |
|---|---|---|---|
| 9 | 2026-11-12 | Hold to talk fails on iPhone | 🔴 open |
| 8 | 2026-11-12 | A spoken turn takes ~15 s (target 3 s) | 🔴 open |
| 7 | 2026-11-12 | Laddu's voice switched to an English accent on his second line | 🔴 open |
| 6 | 2026-11-12 | Scene background (sky, grass) missing in the real chat | 🔴 open |
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

### 8. A spoken turn takes ~15 s
- **Happened:** `POST /talk` 13.4 s, then `GET /api/speech` 1.4 s. A typed turn
  (`/send`) took 11.6 s.
- **Why (likely):** every step runs one after another (hear → Tanglish rewrite →
  score → reply → voice), and Laddu waits for all of it.
- **Fix planned:** reply first, voice on the first sentence, score and bubble
  text in the background (spec 003, "After the first phone test"). Use the
  `api_calls` log to see which steps are slow.

### 7. Laddu's accent changed
- **Happened:** Charlie's first line sounded great; the second had a strong
  English accent.
- **Likely why:** the voice guesses the language from the text. If it got
  Tanglish (English letters) instead of the hidden Tamil-script line, it read it
  as English. Fix: always send the Tamil-script line; set the language to Tamil
  where the voice model allows (ElevenLabs Flash can).

### 6. Scene background missing
- The approved draft had sky, grass and sun; the real chat didn't.

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
