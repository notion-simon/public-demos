# Weather Witch: Forecast a Lie — Simplified Implementation Spec

## Goal (new fun-first rubric)
Build a browser game that is fun within 30 seconds, with **one readable core mechanic** and strong feedback.

## Core Mechanic (single verb)
**Click the glowing sigil exactly as the bright scanline passes through it.**

- If you hit: belief rises, the studio “locks in,” and your forecast becomes more real.
- If you miss: belief drops a bit and static increases.

This is the whole game’s skill expression: **aim + timing + rhythm.**

## Core Loop
For each day (5 total):
1. Briefing: a town crisis needs a specific weather.
2. Choose your forecast (Rain / Sun / Wind / Lightning).
3. Go Live (20 seconds): hit enough sigils to reach the belief threshold.
4. Result: Success advances to next day; Failure lets you retry instantly.

## Clarity / Cause & Effect
- The UI always shows:
  - Required weather for the day
  - Your chosen forecast
  - Belief meter + a clear threshold marker (how much belief you need)
  - Time remaining
- Choosing the **wrong** forecast is allowed, but the belief threshold is visibly higher.

## Difficulty / Fairness
- Correct forecast: moderate threshold (achievable for first-time players).
- Wrong forecast: high threshold (possible with strong play, but clearly harder).
- Failure is non-punitive: instant retry from the same day.

## Visual Identity
- CRT weather broadcast frame, neon isobars, occult circles.
- Target sigils are bright, animated, and obviously clickable.
- Hits produce a satisfying pulse + particles; misses produce glitch/static.

## Audio
- WebAudio procedural soundtrack.
- Hit SFX: bright chime; Miss SFX: low thud + static.
- Belief affects mix: more belief = less static + brighter music.
- Volume slider + mute toggle.

## Screens / Flow
- Intro overlay with short explanation + Play button (unlocks audio).
- Briefing overlay each day.
- Live broadcast canvas gameplay.
- Result overlay (success/fail) with Continue/Retry.
- Win overlay after Day 5.

## Files
- `index.html`, `styles.css`, `main.js`
- No external dependencies, no server.

## Testing Plan (agent-browser)
- Verify intro + Play enters game and audio unlocks.
- Verify a full day: choose forecast → live → result.
- Verify failure → retry loop.
- Verify win flow after day 5.
- Verify mute/volume.
- Verify no missing assets and no console-breaking errors.

