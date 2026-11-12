# Voice bake-off: hearing test

Nisha's 15 recordings (156 s of audio in all), each transcribed once per service.
Recordings and transcripts are private; this table is the summary only.

- **Sound-alike error**: how far the transcript is from what she said, letter by letter, after ignoring spelling and script (0% = perfect). No AI involved.
- **Words wrong / English kept / Mistakes fixed**: from the AI grader (Claude Haiku). "Fixed" = the service quietly turned what she said into more standard Tamil (bad for scoring).

| Service | Model | Done | Sound-alike error | Words wrong | English kept | Mistakes fixed | Median time | Writes in | Tested |
|---|---|---|---|---|---|---|---|---|---|
| ElevenLabs | scribe_v2 | 15/15 | 6% | 11/198 (6%) | 37/37 | 3 | 0.6 s | Tamil script | 2026-11-11 |
| Azure Speech | fast transcription 2024-11-15 | 15/15 | 12% | 23/198 (12%) | 30/33 | 6 | 0.8 s | Tamil script | 2026-11-11 |

Cost: about 2.6 minutes of audio per service; check each price page (or the free tier) for the rate.
