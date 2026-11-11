# 001: Chat v1 (correction, score /10, try again, continue)

**Status:** ✅ Approved by Nisha (2026-11-09)
**Phase:** 3 (SCOPING.md §10)
**Based on:** SCOPING.md §0 (MVP flow), §1a (rubric v2), the Q&A of 2026-11-07, and the Laddu brainstorm of 2026-11-09

**Priorities:** accuracy first, fun second. Don't put everything in my face on every message.

## Problem + user story

As a heritage speaker who knows roughly *what* I want to say but not *how*, I want
to **type** a message in Tanglish (English mixed in is fine) and see how a native
speaker would say it, with a small score and a chance to try again, before the
tutor carries on the conversation. That way every message is practice with
correction, and it still feels like chatting with a friend, not taking a test.

**Laddu** 🧸 is the tutor: a cute teddy bear who is my friend. Laddu talks in speech
bubbles, and my side of the chat shows one fixed cartoon girl (me).

## The flow

```
Welcome   🧸 Vaanga, Nisha!
          Come on in, Nisha!
          [I start]  [Laddu starts]
          Past chats ›
   ↓ Laddu starts: Laddu picks a random situation and opens it
     🧸 "Tea kadaiku vandhuttom! Enna order pannalaam?"
        (We're at the tea shop! What shall we order?)
Turn loop      (Laddu's bubbles on the left · 👧 my bubbles on the right)
  👧 You:  En naal nalla illa.

         Inniki naal sariyaa pogala.          ⭐ 7
         (tap for the English)                (tap for the pie)
         I understood: "My day wasn't good."
         🏷 too literal
         [Tell me more]  [🔁 Try again]  [➡️ Continue]   Looks wrong?

  Continue → 🧸 Laddu replies in one sentence (Tanglish, English below)
```

## Acceptance criteria

**Welcome and starting**
- [ ] After login, `/` is the welcome screen: Laddu with *"Vaanga, Nisha!"* in
      Tanglish and the English underneath (the name comes from my profile), and two
      buttons: **I start** and **Laddu starts**. A **Past chats** link is visible.
      No Speak / Chat / Game buttons (voice arrives inside the chat in phase 5). The
      lesson browser moves to `/lessons`.
- [ ] **I start** opens the chat with an empty message box (no example prompts in v1).
- [ ] **Laddu starts** needs no choosing: Laddu picks a **random situation** from a
      list of ~10 in the config file (never the same as last time), sets the scene
      in one line and asks the first question, in Tanglish with the English
      underneath. In a situation, Laddu plays the other person (the tea-shop owner,
      the auto driver, a friend asking about my day…).
- [ ] Starter situations: tea shop (chai and coffee), auto ride, telling a friend
      about my day, grocery shop, ordering food at a restaurant, asking for
      directions, weekend plans, at the doctor's, a phone call with a relative,
      shopping for clothes. Nisha can edit the list later.

**Look and feel**
- [ ] A cute cartoon **Laddu** (teddy bear) appears on the welcome screen and next
      to each of Laddu's messages, with the words in a **speech bubble** coming from
      Laddu. My messages are bubbles on the other side, next to one fixed
      **cartoon girl** (me). No character picking.
- [ ] v1 drawings are simple vector drawings made in the code (no image service),
      shown to Nisha for approval, and easy to swap for nicer art later.

**The correction card (every message I send)**
- [ ] Shows, in this order: the **better way** in Tanglish (its English appears
      only when I tap it); a **small score ⭐ n/10** (tapping it opens a pie of the
      two parts); **"I understood: …"**, the tutor's reading of my message in
      English; and the **mistake types** as small tags.
- [ ] **That's not what I meant** under "I understood" lets me type what I meant in
      English; the card then re-does the better way and score for that meaning.
- [ ] **Tell me more** opens the one-line why and, when there is one, a second way
      to say it. Nothing else is shown until I tap.
- [ ] **Score (rubric v2):** grammar 0–6 + sounding like spoken Tamil 0–4 = total
      0–10. Whole numbers, always within range, and the total always equals the sum.
      Meaning is **not** scored; it's shown as "I understood".
- [ ] **Mistake types** come from a fixed list: verb tense, verb ending, missing case
      ending, word order, wrong word, missing word, too formal, too literal.
- [ ] **English words are never mistakes** (bus, phone, computer, office…). The
      better way never swaps in pure-Tamil words people don't actually say.
- [ ] **Spelling is never a mistake.** *kudikkura* and *kudikkuraa* are both fine.
- [ ] **Spoken Tamil is the target.** A correct but formal sentence gets the spoken
      version as the better way and the "too formal" tag.
- [ ] **Right tone for who I'm talking to:** with Laddu (a friend), casual *nee* is
      correct; in a situation where Laddu plays a shopkeeper, driver or elder,
      polite *neenga* is expected.
- [ ] **Perfect message (10/10):** instead of a correction, a happy line from Laddu
      from a rotating set of ~20 with emojis (e.g. *"Semma Nisha! 🔥"*), never the
      same one twice in a row.
- [ ] **All-English message:** no score. The card shows the Tanglish way to say it
      and "Try saying it in Tanglish".

**Try again and continue**
- [ ] **Try again** first offers **"Want a hint?"** (the hint gives one clue, never
      the full answer). My new attempt is scored against what I originally meant,
      and the card shows both scores (⭐ 6 → 9). I can retry as often as I like.
- [ ] The tutor **waits until I tap Continue** (or send a new message) before replying.
- [ ] **Laddu is a friend:** fun, casual and encouraging, like a close friend my age
      who's excited to hear about my day (a little teasing is fine; never mean). Uses
      my name. Replies are **one sentence** in casual spoken Tanglish with the English
      underneath, respond to what I meant, and keep the conversation going. Now and
      then Laddu slips in a new word with its meaning.

**Past conversations**
- [ ] **Past chats** lists my conversations, newest first: date, topic (or first
      message), number of messages, and average score.
- [ ] Opening one shows the whole conversation, including correction cards
      (read-only in v1).
- [ ] **Delete** a conversation (with a "Delete this chat?" confirm step in the page)
      removes it and its messages and scores for good.

**Rules that always hold**
- [ ] **No Tamil script ever reaches the screen.** Every model answer is checked on
      the server. If it contains Tamil letters, it's retried once, then replaced with
      the friendly error. It's never shown.
- [ ] Asked for Tamil script, the tutor kindly says it only uses Tanglish.
- [ ] **Safety:** Claude's built-in safety, plus two lines in the tutor's
      instructions: steer back to everyday topics if a conversation turns to
      violence, harassment or sexual content; and if I express thoughts of harming
      myself or others, step out of the lesson, respond with care, suggest talking to
      someone and a helpline (988 in the US), and don't score that message.
- [ ] **Looks wrong?** on a card saves a flag (my message, the better way, the score,
      an optional note), shown on My flags as "from chat".
- [ ] **Daily cap:** after 60 messages in a day I see "See you tomorrow" instead of a
      model call. Counted by a database function, so the app doesn't need the
      Supabase secret key.
- [ ] **Errors:** if the model is slow (> 15 s) or fails: *"Aiyo! Something broke on
      my side 😅 Your message is safe, tap to try again."* My message isn't lost.
- [ ] **Speed:** the card appears within 3 s of sending (typical, on Wi-Fi); the reply
      starts within 3 s of tapping Continue.
- [ ] **Stored privately** (RLS, own rows only): conversations, messages, attempts,
      and scores with parts, mistake types, prompt version and model.
- [ ] **Prompts** in versioned files (`prompts/corrector_scorer_v1.md`,
      `prompts/tutor_system_v1.md`); model name, cap, prompt versions and the
      praise lines in one config file.
- [ ] The Anthropic key is a Codespaces secret (`ANTHROPIC_API_KEY`), used only on the server.

## Out of scope

- Speaking, voice, 🔊/🔇, slow/replay, captions: **phase 5**
- Weak-spots memory steering conversations, and the progress screen: **phase 6**
- Gold set, eval script, model comparison: **phase 4** (v1 has only the smoke eval below)
- Continuing an old conversation (past chats are read-only in v1)
- Example prompts when I start ("I'm on the bus…"): decide after using v1
- New-word dictionary (Later Ideas); v1 only mentions new words in replies
- A separate content-moderation filter: before anyone else uses the app
- Using lesson content in the tutor's context (SCOPING §4)
- 👍/👎, `ai_requests` logging, HQ dashboard: **phase 7**
- Memes; deploying to Vercel (**phase 8**); the 6-digit login code (separate small fix)
- Making or choosing your own character; different characters per user (Later Ideas)
- Pictures drawn live for each moment of the chat, e.g. me on the bus (Later Ideas)
- Picking a situation from a list (v1 is random only)

## How it's built (short)

- **Two model calls per turn** (SCOPING §2): `corrector_scorer` returns structured
  JSON (better way, alternative, "I understood", parts, why, mistake types), then
  on Continue `tutor_system` streams the reply. Separate so phase 4 can evaluate
  the scorer alone.
- **Model:** Claude Haiku (latest), set in config.
- **New tables:** conversations, messages (an attempt links to the message it
  retries), scores; all RLS. A database function counts usage against the cap.
  `flags` gets an optional `message_id`. Deleting a conversation cascades.

## Tests + evals

**Automated (in CI, fake model, no cost):**
- *Scorer output check:* accepts a well-formed answer; rejects a wrong total, an
  out-of-range part, or an unknown mistake type.
- *Tamil-script guard:* nothing with Tamil letters is ever passed to the screen.
- *Laddu starts:* the opener comes from the situation list and is never the
  same situation twice in a row.
- *Turn flow with a fake model:* send → card saved → try again links to the original
  and shows both scores → continue streams a reply; "That's not what I meant"
  re-scores; a model error keeps the message, retryable.
- *All-English and perfect messages:* no score / praise line, as specified.
- *Daily cap:* the 61st message gets "See you tomorrow"; a new day resets.
- *Past chats:* listed newest first; delete removes messages and scores.
- *Privacy (in `tests/rls.test.ts`):* another user can't see, change, delete or fake
  my conversations, messages or scores, or bump my usage count.

**Smoke eval (real model, about $0.05, results table shown to Nisha):** ~15 cases ×
3 runs: already-correct spoken sentences, the §1a example, a formal sentence,
English words mixed in, misspelled Tanglish, an all-English message, "write it in
Tamil script please", off-topic, and one safety case. Targets:
- 100% valid scorer output; 100% no Tamil script
- Already-correct sentences score 9–10 and aren't "fixed"
- English words and spelling variants are never tagged as mistakes
- Same message → total within ±1 across runs (≥ 90%)
- The safety case gets a caring reply and no score

**Done when (Nisha, on her phone):** I send 10 real messages and the corrections
feel right; Laddu starts a random situation and feels like a friend; I try again, continue, flag a card, open a past chat, delete one, and
never see Tamil script.

## The big questions behind this project

These are the questions I asked myself when I came up with the idea. Each phase
helps answer part of them.

**1. Can an affordable speech-to-text model actually understand and correct
spoken Tamil well enough to be useful?**

This question has two halves, and the project tests them separately on purpose:
- **Correct:** can a cheap, fast AI model (Claude Haiku) correct my Tanglish the
  way a native speaker would, in spoken Tamil, not textbook Tamil?
  - **This spec (v1)** tests it with typed messages. "Done" = 10 real messages
    where the corrections feel right.
  - **Phase 4** measures it properly: a gold set of ~40 messages scored by a
    fluent speaker, compared with the app's scores, across 2–3 models.
- **Understand speech:** can affordable speech-to-text hear mixed Tamil +
  English (Tanglish) accurately? Tested in **phase 5** (voice).

Splitting them means that if the answer is "not good enough," I'll know which
half failed: the hearing or the correcting.

*To think about for interviews:* what does "useful" mean in numbers? (e.g. the
app's score is within ±1 of a fluent speaker's on 80% of messages; speech is
heard correctly most of the time.) What does "affordable" mean? (e.g. under
$5 a month for me.) What would I do if one half fails?

**2.** *(to add)*

## Decisions log for this spec

**2026-11-09:** the tutor is **Laddu** 🧸, a teddy-bear friend (not amma-style) ·
welcome is "Vaanga, Nisha!" with **I start / Laddu starts** (no Speak/Chat/Game
buttons) · Laddu starts = a random situation, no choosing · speech bubbles · one
fixed girl character for me, no character picking · cap stays 60 per person per
day · voice stays in phase 5 · no agent: a fixed two-step workflow.

**2026-11-07:**

Meaning out of the score, shown as "I understood" (grammar 6 + natural 4) · Option A
(wait for Continue) · all-English: no score · cap 60, "See you tomorrow" · ~~amma-style
tutor, name and sometimes *kanna*~~ (now Laddu, a friend), one-sentence replies · past chats with delete in v1
· Claude's built-in safety + minimal rules for v1 · card layout as sketched · topics
with Surprise me · retry shows both scores, optional hint · English words never
mistakes · rotating praise lines · friendly error wording · done = 10 real messages
feel right.
