# 001: Chat v1 (correction, score /10, try again, continue)

**Status:** Draft, waiting for Nisha's approval
**Phase:** 3 (SCOPING.md §10)
**Based on:** SCOPING.md §0 (MVP flow) and §1a (rubric v1)

## Problem + user story

As a heritage speaker who knows roughly *what* I want to say but not *how*, I want
to **type** a message in Tanglish (English mixed in is fine) and immediately see
how a native speaker would say it, a score out of 10 with a one-line reason, and a
chance to try again, before the tutor carries on the conversation. That way every
message I send is practice with correction, not just chatting.

## The flow

```
Welcome  "Vanakkam! Inniki enna pannalaam?"
         [🎤 Speak · coming soon]  [💬 Chat]  [🎮 Game · coming soon]
   ↓ Chat
Who starts?  "Yaaru start pannuvaanga?"
         [I start]  [You start]
   ↓
Turn loop
  1. I type my message
  2. Correction card:  You said → Better way (Tanglish + English) → 6/10
                       grammar 3/5 · meaning 2/3 · natural 1/2
                       Why: "naalaikki" means tomorrow; for "later" say "appuram".
                       [🔁 Try again]  [➡️ Continue]  (Looks wrong?)
  3. Try again → I type it again → new score shown on the same card
  4. Continue → tutor replies (Tanglish, with the English meaning below), streamed
```

## Acceptance criteria

**Welcome + who starts**
- [ ] After login, `/` shows the welcome screen with the greeting in Tanglish and
      its English meaning. **Chat** works; **Speak** and **Game** are visible but
      marked "coming soon" and do nothing. (The lesson browser moves to `/lessons`.)
- [ ] Chat asks "who starts?". **I start** gives me an empty message box.
      **You start** shows a tutor opening question (Tanglish + English), e.g.
      *"Inniki naal eppadi irundhuchu?"* (How was your day today?), on an everyday
      topic: my day, work, food, family, weekend.

**Every turn**
- [ ] A message that is entirely English gets no score: the card shows the Tanglish way to say it and "Try saying it in Tanglish".
- [ ] I can send Tanglish, English, or a mix. Tanglish spelling is free-form
      (*kudikkura* / *kudikkuraa*).
- [ ] The correction card shows: what I said, a better way to say it (Tanglish +
      English meaning), a total score /10 with the three parts (grammar 0–5,
      meaning 0–3, naturalness 0–2, per rubric v1), a one-line why, and mistake
      types from the fixed list (verb tense, verb ending, missing case ending, word
      order, wrong word, English word used, too formal).
- [ ] The total always equals the sum of the three parts. Every part is a whole
      number within its range.
- [ ] **Spelling variants are not mistakes.** A message that is already natural
      spoken Tamil scores 9–10, and its "better way" is the same sentence (or says
      "Perfect, no change needed").
- [ ] **Spoken Tamil is the target.** A correct but formal sentence (*kudikkiraai*)
      gets the spoken version as the better way and the "too formal" tag.
- [ ] **Try again** lets me retype. The new attempt is scored the same way, against
      what I originally meant, and shown on the same card (first score → new score).
      I can try as many times as I like.
- [ ] **Continue** (or just typing my next message) brings the tutor's reply. It
      responds to what I meant, keeps the conversation going, is in spoken-style
      Tanglish with the English meaning, and is short (1–3 sentences).
- [ ] The correction appears within **3 seconds** of sending (p50, on phone over
      Wi-Fi); the tutor reply starts streaming within 3 seconds of tapping Continue.

**Rules that always hold**
- [ ] **No Tamil script ever reaches the screen.** Anything the model returns is
      checked on the server. If it contains Tamil script, it's retried once, then
      replaced with a friendly error. It's never shown.
- [ ] If I ask for Tamil script ("write it in Tamil letters"), the tutor kindly says
      it uses Tanglish only.
- [ ] **Looks wrong?** on a correction card saves a flag (my message, the better
      way, the score, an optional note) that shows up on My flags as "from chat".
- [ ] **Daily cap:** after 60 messages in a day (set in config), I see a friendly
      "come back tomorrow" message instead of a call to the model. Usage is counted
      by a database function, so the app doesn't need the Supabase secret key.
- [ ] If the model is slow (> 15 s) or errors, I see "Something went wrong, tap to
      retry", and my message isn't lost.
- [ ] **Stored privately** (RLS, own rows only): each conversation, every message,
      every attempt, and each score with its parts, mistake types, prompt version
      and model. Phase 6 (progress) and phase 4 (evals) need this.
- [ ] Prompts live in versioned files: `prompts/corrector_scorer_v1.md` and
      `prompts/tutor_system_v1.md`. The model name, cap and prompt versions are in
      one config file, not scattered in code.
- [ ] The Anthropic API key is a Codespaces secret (`ANTHROPIC_API_KEY`), used only
      on the server.

## Out of scope (later phases)

- Speaking, voice output, 🔊/🔇, slow/replay, captions: **phase 5**
- Weak-spots memory steering conversations, and the progress screen: **phase 6**
- Gold set, eval script, model comparison: **phase 4** (v1 has only a small smoke eval, below)
- Using lesson content in the tutor's context (SCOPING §4). The tutor must work without it.
- `ai_requests` logging and the HQ dashboard: **phase 7**
- 👍/👎 on tutor replies (SCOPING §6): with phase 7 logging
- Deploying to Vercel: **phase 8**. v1 runs from Codespaces.
- Game, flashcards, other users

## How it's built (short)

- **Two model calls per turn**, matching SCOPING §2's prompts: `corrector_scorer`
  (returns structured JSON: better version, parts, reason, mistake types) runs
  first, then `tutor_system` streams the reply. Keeping them separate means the
  scorer can be evaluated on its own in phase 4.
- **Model:** Claude Haiku (latest), set in config. Phase 4 compares others.
- **New tables:** conversations, messages (learner / tutor; an attempt links to the
  message it retries), and scores. All with RLS, plus a usage-counting function.
  `flags` gets an optional `message_id` for chat flags.

## Tests + evals

**Automated (run in CI, no real model calls, no cost):**
- *Scorer output check:* a well-formed answer is accepted; a total that doesn't add
  up, a part out of range, or an unknown mistake type is rejected.
- *Tamil-script guard:* any reply containing Tamil letters is never passed to the
  screen.
- *Turn flow with a fake model:* send → correction saved → try again links to the
  original and is re-scored → continue streams a reply; a model error leaves the
  message saved and retryable.
- *Daily cap:* the 61st message is refused with the friendly message; a new day resets.
- *Privacy (added to `tests/rls.test.ts`):* another user can't see, change, delete or
  fake my conversations, messages or scores, and can't bump my usage count.

**Smoke eval (manual, real model, about $0.05):** `npm run eval:smoke` runs ~12
cases from SCOPING §2's mix: already-correct spoken sentences, the rubric example
from §1a, a formal sentence, English mixed in, misspelled Tanglish, "write it in
Tamil script please", and an off-topic message. Each runs 3 times. Targets:
- 100% valid scorer output; 100% no Tamil script
- Already-correct sentences score 9–10 and aren't "fixed" (all of them)
- Same message → total within ±1 across runs (≥ 90%)
- The §1a example lands at 5–7

Results are saved to `evaluation/results/` so phase 4 has a starting point.

**Manual check on my phone:** start a chat both ways, send the §1a example, try
again, continue, flag a correction and find it on My flags, and confirm no Tamil
script appears anywhere.

## Open questions ✍️ (my suggestion in bold)

1. **Try again vs. continue:** should the tutor wait for me to tap Continue (as
   written above), or reply automatically while the Try again button stays on the
   card? **Wait for Continue in v1. It matches your flow and keeps the focus on
   correcting yourself.**
2. ~~All-English message~~ **Decided 2026-11-07:** no score. Show the Tanglish way and prompt "Try saying it in Tanglish". (You didn't try yet, so it shouldn't count.)
3. ~~Daily cap~~ **Decided 2026-11-07:** 60 messages/day (about $0.10/day).
4. **Rubric examples** haven't been checked by your teacher yet. **Use rubric v1 as
   it is for now; phase 4's gold set is where a fluent speaker checks it.**
