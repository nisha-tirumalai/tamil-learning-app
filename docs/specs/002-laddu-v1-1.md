# 002: Laddu v1.1 (calmer screen, instant replies, stays in the scene)

**Status:** Draft, waiting for Nisha's approval (2026-11-10)
**Phase:** 3b (SCOPING.md §10), before voice (phase 5)
**Based on:** Nisha's first real chat with Laddu on her phone, 2026-11-10

## Problem + user story

After trying v1 on my phone:
- **Too many words.** Every bubble shows the English, and every message gets a
  big correction card. It feels like homework, not a chat.
- **Waiting for the score is slow.** I have to wait for the card, then tap
  Continue, before Laddu answers. I don't care about my score on every message.
- **Laddu doesn't keep the conversation going.** At the grocery shop, he stopped
  being the shopkeeper, gave me cooking tips, and didn't ask me anything back.
- **I only say what I already know.** Nothing pushes me to try new things.

As a learner, I want to **chat with Laddu the way I'd chat with a friend**:
he answers right away, stays in the scene, asks me things that make me try new
sentences, and my score is there **only when I want to look at it**.

```
  🧸 Kadai-la nalla kootam irukku, enna vaangalaam?        (tap → English)

          Na konjam sweets samaikkiren, Mysore pak!   👧
                                         ⭐ 6 ›    ← tap to open the card

  🧸 Ooh, Mysore pak-aa! Adhukku enna enna venum, sollu?   (tap → English)
     (replies right away; the ⭐ chip fills in when the score is ready)
```

## Acceptance criteria

**Fewer words on screen**
- [ ] Laddu's bubbles show **only the Tanglish**. Tapping a bubble shows the
      English underneath; tapping again hides it. Same for his opening line.
- [ ] Under each of my messages there's a **small ⭐ chip** instead of the card:
      ⭐ 6 for a scored message; the praise line for a 10/10 (e.g. *"Semma,
      Nisha! 🔥"*); "Try it in Tanglish" for an all-English message; nothing
      for a safety message.
- [ ] **Tapping the chip opens the correction card** (the better way, its English
      on tap, I understood, That's not what I meant, mistake tags, Tell me more,
      Try again, Looks wrong?). Tapping again closes it. Closed by default.
- [ ] Past chats show the same chips, closed by default.

**Laddu answers right away**
- [ ] When I send a message, **Laddu's reply starts within 3 s**. The score is
      worked out **at the same time**; the chip shows a small "…" until it's
      ready, then fills in. Neither waits for the other.
- [ ] **No Continue button.** (Replaces spec 001's "wait for Continue".)
- [ ] If the score fails, Laddu's reply still arrives, and the chip says
      "Score didn't load · tap to retry". If the reply fails, the friendly
      "Aiyo!" error appears with a tap to retry, and the score still shows.
- [ ] **Try again** (from the open card) re-scores my new attempt and shows both
      scores (⭐ 6 → 9), as before. Laddu doesn't reply again to a retry; the
      chat carries on from my next message.
- [ ] Laddu reads **my own message** to reply, not the scorer's guess, so a wrong
      "I understood" doesn't send the conversation off track.
- [ ] **Safety still works without the score:** Laddu's instructions handle the
      safety rule from spec 001 by themselves (step out, respond with care,
      suggest a helpline), and that message gets no score.
- [ ] Daily cap: one sent message counts once (reply + score together). Each
      Try again still counts, as in v1.

**Laddu keeps the conversation going**
- [ ] **Stays in the scene.** When Laddu starts a situation, he stays in his role
      (the shopkeeper, the auto driver…) for the whole chat, unless I change the
      subject. When I start, he stays a friend.
- [ ] **Every reply ends with a question or an invitation** to me. Replies are
      one or two short sentences (spec 001 said one; a reaction + a question
      needs two).
- [ ] **Reacts to what I actually said** (if I'm making sweets, he asks about the
      sweets) before moving the scene along.
- [ ] **Stretch questions (simple version):** Laddu asks for specific details
      (how much, how many, who for, when, why) rather than yes/no questions. Now
      and then he asks me to try something I haven't said yet ("Shopkeeper-kitta
      vilai kammi pannunga-nu kelu!", *ask the shopkeeper for a discount!*) or to
      use a new word he just taught me.
- [ ] New prompt version: `prompts/tutor_system_v2.md` (v1 is kept, so they can
      be compared). Config points at v2.

**Unchanged from spec 001:** no Tamil script on screen (both answers checked),
private storage, flags, past chats and delete, the cap, the friendly error,
Laddu's personality.

## Out of scope

- Voice, mute, Laddu big and talking with his mouth moving: **phase 5** (spec 003)
- Vocab list Laddu remembers, smarter stretch mode based on my weak spots: **phase 6**
- One model per job, gold set: **phase 4**
- Going live on Vercel: separate step (see PLAN.md)
- Fixing specific scorer mistakes (like *samaikkiren* read as "worship"): those
  go to flags → gold set → prompt changes, measured in phase 4

## Tests + evals

**Automated (CI, fake model, no cost):**
- *Screen:* Laddu's English is hidden until tapped; the chip is closed by default
  and opens the card; the right chip shows for scored, 10/10, all-English and
  safety messages.
- *Instant reply:* with a fake model where the score is slow, the reply still
  arrives first; with a failing scorer, the reply arrives and the chip offers a
  retry; with a failing reply, the score still saves and the error is retryable.
- *Try again:* re-scores, links to the original, shows both scores, no new reply.
- *Cap:* one message + its reply counts once.

**Smoke eval (real model, ~$0.05), extended with ~6 conversation cases:**
a situation + a message from me, e.g. the grocery shop + "I'm making sweets".
- 100% of replies end with a question or invitation
- 100% no Tamil script
- Replies stay in role (Nisha reads the 6 replies in the results table and
  marks each ✅/❌; target: all ✅)
- Add *"na konjam sweets samikiren"* as a watch case: what does "I understood" say?

**Done when (Nisha, on her phone):** I chat 10 messages; Laddu answers quickly,
the screen feels calm, I open a few ⭐ chips and they're useful, and Laddu keeps
the scene going with questions that make me try new things.

## Open questions (my suggested answer in brackets)

- ✍️ 10/10 messages: show the praise line right in the chip, or just ⭐ 10?
  [praise in the chip, it's fun]
- ✍️ Should a big mistake show a tiny hint without opening the chip, e.g. a
  red dot? [no, keep it calm for now]
- ✍️ After Try again, should Laddu react ("Ah, ippo correct!")? [no, keeps it
  simple; revisit with voice]
