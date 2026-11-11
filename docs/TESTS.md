# What the tests check

Run them yourself with `npm test`. GitHub Actions runs them on every push: open
the repo's **Actions** tab to see the results.

`npm test` runs the lesson and chat building-block tests. The database tests skip themselves
unless a test database is set up. `npm run test:db` (in Codespaces) starts one and runs everything, and so does GitHub Actions.

## Lesson data (`tests/lessons.test.ts`)

| Test | In plain English |
|------|------------------|
| every item has its own id | No two items share an id, so a flag or a review always points at exactly one item. |
| every item has English and Tanglish | No blank cards. |
| no Tamil script in the text the app displays | The brief's rule: users never see Tamil script. Fails if any English or Tanglish contains Tamil letters. |
| the stored Tamil really is Tamil script | Whatever text-to-speech will read is real Tamil, not English pasted in the wrong column. |
| namaskāram and nandri are there as greetings | The two greetings from Adi's Book are present, with Tamil for the voice. |
| cards never include the Tamil script | Checks every card the app could send to a phone. The Tamil is left out completely, not just hidden. |
| every lesson is listed, including Adi's Book | The home page shows Lessons 1–12 (there's no Lesson 6) and the book. |
| a flag's snapshot comes from the real item | When you flag a card, the app saves the item's real English and Tanglish (looked up on the server), and rejects unknown items. |

## Database security (`tests/rls.test.ts`)

These create two pretend users, **Alice** and **Bala**, in a throwaway database,
then try to break the privacy rules.

| Test | In plain English |
|------|------------------|
| someone not on the allowlist can't sign up | The invite-only rule is enforced by the database, not just the login page. |
| signing up creates a profile that only its owner can see | Each new user gets settings (voice, pace…) and can see only their own. |
| flags / card_state / review_log / daily_activity: another user can't see, change, delete, or fake your rows | Alice saves something. Bala tries to read it, change it, delete it, and save a row in Alice's name. All four must fail, and Alice's row must be unchanged. Repeated for each private table: flags, flashcard schedule, answer history, practice days. |
| someone who isn't signed in can't read anything private | A logged-out visitor gets nothing from any table. |
| signed-in users can't read or add to the allowlist | Friends can't see who else is invited, or invite themselves. |
| you can change your own settings, but not make yourself an admin | Changing your pace works; setting `is_admin` is refused. |
| you can't change your own usage counts | Nobody can reset their daily chat count to get around the cap. |
| chat: another user can't see, change, delete, or fake your conversations, messages or scores | Bala can't read Alice's chats, slip a message into her conversation, or score her messages. |
| chat: a score's total must equal grammar + spoken | The database itself refuses a 9 that should be a 10, or a grammar score of 7/6. |
| chat: deleting a conversation deletes its messages and scores | Delete really means gone. |
| daily cap | Counts your own messages, stops at the cap, resets on a new day, and can't be used to bump someone else's count. |
| a chat flag can link to its message | "Looks wrong?" on a correction card keeps a link to that card. |

## Chat building blocks (`tests/chat.test.ts`, no database)

| Test | In plain English |
|------|------------------|
| scorer output check | A model answer is accepted only if the score parts are whole numbers in range (grammar 0–6, spoken 0–4), the total is their sum, the mistake types come from the fixed list (no "spelling"!), and there's no Tamil script. All-English and safety messages never get a score. |
| perfect and all-English cards | 10/10 shows a praise line instead of a correction, never the same line twice in a row. |
| Tamil-script guard | Finds Tamil letters anywhere in an answer; none in the praise lines, situations or prompts. |
| Laddu starts | 10 situations; a pick always comes from the list and is never the same as last time. |
| small helpers | "nisha.tirumalai" becomes "Nisha"; Laddu's reply splits into Tanglish + English; try-agains sit under their original. |
| what Laddu sees (spec 002) | He reads your own words, not the scorer's guess (unless you said what you meant); in a situation he's told to stay in his role, otherwise to stay your friend; the config uses tutor prompt v2 and v1 is kept. |

## The chat screen (`tests/screen.test.tsx`, no database)

Draws the bubbles as HTML (no browser) and checks what you'd see.

| Test | In plain English |
|------|------------------|
| Laddu's bubble | Only the Tanglish until you tap; tapped, the English shows underneath. |
| the chip under my message | ⭐ 7 with the card closed; tapped, the card opens (better way, I understood, Try again, Looks wrong?, and no Continue). 10/10 shows the praise line; all-English says "Try it in Tanglish"; a safety message gets no chip and no card; "⭐ …" while the score is coming; "Score didn't load · tap to retry" if it failed (nothing in past chats); "⭐ 7 → 9" after a try again. |

## A whole chat turn (`tests/chat-flow.test.ts`, fake model, needs the test database)

A pretend model gives fixed answers, so these cost nothing and never need the key.

| Test | In plain English |
|------|------------------|
| send: reply first, score saved, counts once | With a slow scorer, Laddu's reply still arrives first; the score is saved too; the daily count goes up by exactly one; Laddu was given your own words. |
| a failing scorer | Laddu's reply still arrives, and the score can be retried. |
| a failing reply | The score still saves, and "tap to try again" gets the reply (without counting again). |
| try again | Scored against what you first meant, shows both scores (6 → 9), and Laddu doesn't reply to it. |
| at the cap, sending | "See you tomorrow", nothing saved, no model call. |
| "That's not what I meant" | The card is redone for the meaning you typed (and replaced, not doubled). |
| a model error keeps my message | Your message is saved even if the model fails, and "try again" works. |
| Tamil script is retried once, then never shown | For both the card and Laddu's reply. Nothing with Tamil letters ever leaves the server. |
| all-English and perfect messages | No score for all-English; a praise line for 10/10. |
| Laddu starts | Situations from the list, never twice in a row, and the opener plays the right person. |
| Looks wrong? | Saves a chat flag linked to the card. |
| past chats | Newest first, with topic, message count and average score; delete removes messages and scores. |
| daily cap | Message 61 gets "See you tomorrow" and makes no model call; a new day resets. |

## Smoke eval (`evaluation/smoke.eval.ts`, REAL model, costs ~$0.05)

Not part of `npm test`. Run it on purpose with `npm run eval:smoke` (needs the
`ANTHROPIC_API_KEY` secret). 15 messages × 3 runs for the scorer, plus 6
conversation cases for Laddu (spec 002: does each reply end with a question or
invitation? any Tamil script?) and the *samikiren* watch case. Saves a results
table to `evaluation/results/`, with an empty **In role?** column for Nisha to
fill in with ✅/❌.

## Type-check (`npm run typecheck`)

Not a test as such: TypeScript reads all the code and catches mistakes like a
misspelled field name before the app runs.
