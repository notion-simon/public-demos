# Weather Witch: Forecast a Lie — Fun-First Spec (Procedural Remix)

## Core Mechanic (single verb)
**Click glowing sigils before they fade to build Belief.**

- Click = success (no hidden rules).
- Optional bonus: clicking as the scanline passes gives a small Belief boost.

## Core Loop
Each day:
1) Briefing: shows the crisis + required weather.
2) Choose forecast.
3) Go Live: click sigils until you reach the visible Need.
4) Result: Retry or Continue.

## Procedural Variation (controlled, readable)
Each new run is a *remix* with constraints:
- **Day sequence**: 5 scenarios drawn from a pool and shuffled with a run seed.
- **Map layout**: each day picks one of several layout masks (Open / Ring / Diagonal / Twin).
- **Broadcast mood**: each day picks one style affecting spawn cadence/TTL (Drizzle / Sparks / Bursts / Drift).
- Minor tuning: scanline speed varies slightly per run.

All variation is explained in the briefing with a short label + hint.

## Fairness
- Correct forecast lowers Need; wrong forecast raises it.
- No punitive "miss" clicks on empty space.
- Failure is non-punitive: retry instantly.

## Audio
- Procedural WebAudio music + noise.
- Belief reduces static and brightens the mix.
- Mute + volume slider.

## Client-only
Static `index.html`, `styles.css`, `main.js`. No network dependencies.

## Testing
Use `agent-browser` to verify:
- Intro → Play works.
- Two fresh runs have different sequences/layouts/styles.
- At least one full 5-day run is finishable.
- Mute/volume.
- Retry on failure.

