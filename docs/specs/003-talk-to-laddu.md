# 003: Talk to Laddu (voice)

**Status:** ✅ Approved by Nisha (2026-11-11)
**Phase:** 5 (SCOPING.md §10), moved up: after 3b (Laddu v1.1), before going live
**Based on:** SCOPING §0 (Speak mode, captions, 🔊/🔇, slow/replay), the
2026-11-10 feedback ("voice has to be a key part"; "Laddu's whole body, his
mouth moving, like we're having a conversation"), and a quick research check

## Problem + user story

Typing isn't fun, and it isn't the skill I want. I want to **speak** Tamil.

As a learner, I want to **talk to Laddu out loud and hear him answer**, like a
video call with a friend: I hold a button and say my sentence in Tanglish,
Laddu answers in a natural Tamil voice with his mouth moving, and I still get my
⭐ score and correction when I tap for it.

```
  (Sketch updated 2026-11-11: the final layout is a side-by-side scene, see
  "The conversation scene" below.)

        ┌───────────────────────────────┐
        │                               │
        │          🧸  (big, full body,  │
        │       mouth moves as he talks)│
        │                               │
        │  "Ooh, Mysore pak-aa! Adhukku │   ← caption while he talks (English on tap)
        │   enna enna venum, sollu?"    │
        │   [🐢 slow] [🔁 again]  [🔇]   │
        │                               │
        │  👧 "Na konjam sweets          │   ← what Laddu heard me say
        │      samaikkiren"   ⭐ 6 ›     │      (tap to fix if he heard wrong)
        │                               │
        │        [ 🎤 hold to talk ]    │
        │        ⌨️ type instead        │
        └───────────────────────────────┘
```

## Step 1 (before building): the voice bake-off

Nobody has published how well these services understand **Tanglish** (Tamil
and English mixed in one sentence). Benchmarks for Indian code-mixed speech are
mixed: one national benchmark reported very high error rates for OpenAI's
models; Google and ElevenLabs claim better Tamil results. So we test with
**my own voice**, then pick. This is a small eval, and a good portfolio story.

**Hearing test (speech-to-text):**
- I record ~15 sentences the way I really talk (see "How Nisha helps"), and
  write down exactly what I said in Tanglish.
- Each candidate service transcribes them: **Azure Speech** (the plan so far),
  **Google Cloud Speech (Chirp)**, **ElevenLabs Scribe**. OpenAI optional.
- Score each: how many words it got wrong, whether it **kept my mistakes** (a
  hearing service that quietly "fixes" my grammar would make my score wrong),
  whether English words survive, and how long it takes.
- Recordings and results stay **out of the public repo**; only the summary
  table goes in.

**Voice test (text-to-speech):**
- The same 5 Laddu lines, spoken by 2–3 candidate voices per service (Azure
  Tamil neural voices, Google Tamil voices, ElevenLabs Tamil voices).
- I listen (ideally with amma) and pick the one that sounds most like a
  real, friendly Tamil speaker.

**Decision:** the winner(s) go into the config, with the results table in the
spec. Hearing and voice can come from different services.

## Acceptance criteria

**Talking**
- [ ] A **🎤 hold-to-talk** button. Release to send. (Holding also stops anyone
      talking for ages and running up the bill; recordings over 30 s are cut off.) The
      first time, the phone asks for microphone permission; if I say no, I see
      how to turn it on, and typing still works.
- [ ] What Laddu heard appears as my bubble in **Tanglish** (never Tamil script).
      If he heard wrong, I can **tap to fix it** by typing, and the fixed text is
      what gets scored, so a hearing mistake is never counted as my mistake.
- [ ] Then everything from spec 002 happens: Laddu replies right away, the ⭐
      chip fills in when the score is ready.
- [ ] **⌨️ Type instead** is always one tap away; I can switch any time.

**Laddu talking**
- [ ] Laddu's voice is **ElevenLabs Charlie** (`eleven_multilingual_v2`),
      chosen in the bake-off (replaces the earlier "little boy" idea).
- [ ] Laddu's reply is **spoken** in the chosen Tamil voice, starting within
      **3 s** of my sending (typical, Wi-Fi).
- [ ] The voice reads a hidden **Tamil-script** version of the reply (made with
      the reply, so pronunciation is right) while the screen only ever shows
      Tanglish. Same rule as always: no Tamil script on screen.
- [ ] **Captions:** while Laddu talks, his words show in Tanglish (one line under
      him); the English is on tap.
- [ ] Laddu's **opening line** in a situation is spoken too.
- [ ] **🐢 Slow** replays the reply more slowly; **🔁 Again** replays it.
- [ ] **🔇 Mute**: Laddu's replies are text only (for the bus); remembered.
- [ ] Sound only starts after I've tapped something (phones require this).

**The conversation scene** (changed 2026-11-11, Nisha's request: "not like texting at all")
- [ ] The chat is a **scene, not a text-message list**: Laddu and my character
      (girl or guy) **stand side by side**, full body, facing each other, like
      two people talking. Laddu on the left, me on the right.
- [ ] **Speech bubbles come out of our mouths** (comic-style, with a tail
      pointing at the speaker). Only the **latest line from each of us** is on
      screen: Laddu's bubble above him, mine above me. When someone speaks, their
      new bubble pops in and replaces their old one.
- [ ] My ⭐ chip sits on the corner of my bubble; tapping it opens the card as a
      panel over the scene (spec 002 contents). Tapping Laddu's bubble shows its
      English.
- [ ] **ⓘ button on Laddu's bubble** (added 2026-11-12): tapping it opens a
      small card with the English of what he just said, so I can always find it
      (tapping the bubble still works too). The English is already saved with
      every reply, so this makes **no extra AI or voice calls**. Text only; a
      "hear it in English" button could come later.
- [ ] **Earlier lines** are one tap away: a small "📜 Earlier" button opens the
      full conversation as a list (same as Past chats). The scene itself stays clean.
- [ ] Works on a phone held upright: the two characters fit side by side, and
      bubbles wrap to a few short lines (Laddu's replies are already 1–2 sentences).
      If a line is too long for a bubble, the bubble scrolls; text is never cut off.
- [ ] Typed messages appear in my bubble the same way as spoken ones.
- [ ] Laddu is **big, full body**. While his voice plays, his
      **mouth moves** (a simple open/close animation that follows the loudness
      of his voice). When he's quiet, he idles (blinks).
- [ ] **Choose your character** (added 2026-11-11): the first time I sign in,
      I pick **girl** or **guy** (two pictures, tap one). It's saved in my profile
      and can be changed in settings. That character stands next to Laddu in
      the scene, with a few poses (normal, blink, "talking" while I hold 🎤).
- [ ] Laddu's poses: mouth closed, mouth open (1–2 shapes), blink, happy,
      thinking. All characters are still images animated by the code (no videos,
      because every reply is new and a video can't be made in 3 seconds).
- [ ] New drawings (Laddu full body, two or three mouth shapes, and my girl
      character) are shown to me for approval first. **Nisha provides pictures**
      for Laddu's look and for her own character's look (pictures she has the
      right to use); they're the style guide. They stay out of the public repo
      unless she says otherwise; only the finished drawings go in.

**Rules that always hold**
- [ ] **Every external call is logged** (added 2026-11-12): each call to Claude,
      ElevenLabs or Azure writes one private row to a log table in Supabase:
      service, job (score, reply, opener, hint, hearing, voice), model or voice,
      how long it took (until it started and until it finished), size (tokens,
      characters or seconds of audio), estimated cost, and any error. **No chat
      text or audio in the log.** The dashboard page that shows it is phase 7.
- [ ] **Hearing and voice services are each one setting** in the config, so
      either can be switched without code changes.
- [ ] **Daily cap:** each spoken message counts like a typed one. A recording
      that's too short, silent or longer than 30 s is rejected before any paid
      call, and doesn't count.
- [ ] **Audio isn't stored** after it's turned into text (only the text is saved,
      as now). Recordings go to our server, then to the hearing service, never
      straight from the phone with a key.
- [ ] New keys (whichever services win) are **Codespaces secrets**, used only on
      the server.
- [ ] **Errors:** if hearing fails: "Aiyo, I couldn't hear that 😅 Try again or
      type it." If the voice fails, the reply still shows as text.
- [ ] Works on my iPhone and in a laptop browser.

## Out of scope

- Scoring my **pronunciation** (Later Ideas: needs separate research)
- A custom or cloned voice for Laddu
- Hands-free conversation (no button, Laddu listens all the time)
- Perfect lip-sync to each sound; smooth professional animation
- Going live on Vercel (next step after this; the mic works on the codespace's
  https address for testing)

## Rough cost (to confirm in the bake-off)

Published prices vary by source; these are estimates at the 60-a-day cap.
- **Laddu's voice:** about $15–16 per million characters for standard neural
  voices. A reply is ~80 characters, so a full day at the cap is ~5,000
  characters: **about $2 a month**, possibly inside a free tier.
- **Hearing me:** roughly $0.20–$1 per hour of audio depending on the service.
  60 messages × ~5 s ≈ 5 minutes a day: **about $1–3 a month**.
- Plus the Claude calls I already pay for. Total stays around **$5 a month**.

## Tests + evals

**Bake-off (step 1):** the hearing test and voice test above, with a results
table: words wrong per service, mistakes kept vs "fixed", English words kept,
speed, cost; and my voice pick.

**Automated (CI, fake hearing + fake voice services, no cost):**
- A recording → text → Tanglish bubble → reply + score (spec 002 flow).
- Tamil script from the hearing service is turned into Tanglish and never sent
  to the screen; the hidden Tamil-script reply goes only to the voice service.
- Too short / silent / too long recordings are rejected and don't count.
- Fixing a mis-heard bubble re-scores the fixed text.
- Mute: no voice call is made.
- Hearing or voice failures show the right friendly message.

**Manual (Nisha, on her phone):** 10 spoken messages in a Laddu-starts
situation: Laddu understands me most of the time, I can fix the times he
doesn't, his voice sounds friendly and Tamil, his mouth moves when he talks,
and mute works on the bus.

## How Nisha helps (her part)

1. **Answer the open questions below.**
2. **Record ~15 sentences** on your phone (Voice Memos), the way you really talk,
   and type out what you said in Tanglish. Include:
   - 3 you're confident are correct
   - 3 with English words mixed in ("bus-la office-ku poren")
   - 3 where you're unsure or probably wrong (so we see if the service keeps the mistake)
   - 3 said fast and casually, like on the phone with amma
   - 3 longer ones (two sentences, like telling Laddu about your day)
   - Record 2 or 3 of them in a noisy place (kitchen, car)
3. **Make free accounts** for the candidates (I'll walk you through each:
   Azure, Google Cloud, ElevenLabs), and add their keys as Codespaces secrets.
4. **Listen to the voice samples** (with amma if you can) and pick Laddu's voice.
5. **Describe Laddu's look**, or share teddy pictures you like.

## Bake-off results and decisions (2026-11-11/12)

- **Hearing: ElevenLabs** (Scribe v2): 6% errors vs Azure's 12%; kept 37/37
  English words (Azure 30/33); "fixed" my grammar 3 times (Azure 6); 0.6 s vs 0.8 s.
- **Laddu's voice: ElevenLabs "Charlie" (deep, confident, energetic) with the
  `eleven_multilingual_v2` model** (decided 2026-11-12). Nisha's favourite of
  all the clips. Bonus: it's an English-speaking voice, so the English words I
  mix in (bus, office, phone) sound natural. Available on the free plan.
  This replaces the earlier "little boy" idea.
- ElevenLabs' Tamil library voices (e.g. Velan) need a paid plan; not needed now.
- Best Azure voice, kept as a backup: `ta-IN-Valluvar:DragonLatestNeural` (no pitch change).
- **Azure is the fallback, not used day to day.** Voice matters a little more
  than hearing, so if ElevenLabs' free credits (10,000 a month, shared by hearing
  and voice) run low, switch **hearing** to Azure (free tier) first and keep
  ElevenLabs for Laddu's voice. If that's still not enough, consider ElevenLabs'
  paid plan.

## Decided by Nisha (2026-11-10)

- **Captions:** yes, Laddu's Tanglish words show while he talks (English on tap).
- **Hold to talk**, so nobody talks for too long and spends too much.
- **Laddu's voice:** a little boy (changed 2026-11-12 to ElevenLabs Charlie, see above).
- **Opening line:** spoken out loud too.
- **No backup plan** written in advance: if the bake-off shows hearing is poor,
  we decide then.
