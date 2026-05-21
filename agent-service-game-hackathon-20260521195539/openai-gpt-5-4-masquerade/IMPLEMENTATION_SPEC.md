# Masquerade of the Thirteenth Moon — Simplified Implementation Spec

## Design Goal
Refocus the game around **one clear central mechanic** that is understandable within 30 seconds:

> **Press Space on the musical beat to release a dance pulse that charms nearby guests and creates a safe opening.**

Everything else exists to support that mechanic.

## Player Fantasy
You are an intruder at a cursed moonlit ball. You do not fight, talk through menus, or juggle multiple systems. You move through the crowd and time elegant dance pulses to slip past hostile eyes.

## Core Loop
1. Move through the ballroom.
2. Time a dance pulse on the beat.
3. Nearby guests are charmed and stop watching you for a short time.
4. Use that safe window to cross guarded lanes and collect glowing whispered secrets.
5. After 3 secrets, the Moon Gate opens.
6. Reach the gate before suspicion fills.

## Controls
- Move: WASD / Arrow Keys
- Dance Pulse: Space
- Pause: Esc or P
- Mute / Volume: UI buttons and slider

## Rules
### Central mechanic: Dance Pulse
- The ballroom music has a strong repeating beat.
- Pressing **Space on-beat** emits a bright pulse.
- Guests within range become **charmed** for a short duration:
  - they twirl instead of watching you
  - their detection cones fade
  - suspicion drops slightly
- Pressing **Space off-beat** emits a messy pulse:
  - nearby guests become more alert
  - suspicion rises
  - strong red feedback plays immediately

### Detection
- Uncharmed guests project visible cones.
- Standing in a cone raises suspicion.
- When not seen, suspicion slowly falls.
- If suspicion reaches 100, you lose.

### Objective flow
- Three glowing secrets are placed in guarded parts of the ballroom.
- Walking into a secret automatically collects it.
- After the third secret, the Moon Gate opens automatically.
- Walking into the open gate wins.

## Scope
A polished single-screen top-down mini-game playable in a few minutes.

## Visual Plan
- Moonlit rococo ballroom in top-down 2D canvas
- Highly readable guest cones, charm glows, pulse rings, and secret pickups
- Distinct purple/gold palette with silver moonlight accents
- Strong state changes:
  - gold pulse = success
  - crimson pulse = miss
  - blue-white spin glow = charmed guests
  - bright gate bloom = opened exit

## Audio Plan
### Music
Procedural waltz-like loop using Web Audio API:
- clear beat pulse
- bell melody
- soft pad
- tension layer at high suspicion

### SFX
- menu click chime
- on-beat pulse flourish
- off-beat discord cue
- secret pickup shimmer
- gate opening swell
- win / loss stings

### Audio UX
- Audio unlocks through Play button
- Mute toggle and volume slider on intro and HUD
- No external audio files required

## UX / Clarity
### Intro screen copy
Short and direct:
- Move with WASD / Arrows
- Press Space on the beat to charm nearby guests
- Collect 3 secrets and escape

### HUD
- Suspicion meter
- Secrets count
- Beat indicator
- One short hint line

## Testing Checklist
Manual browser testing must verify:
- intro screen appears first
- Play starts game and audio
- movement works
- on-beat pulse charms guests
- off-beat pulse causes alert / suspicion increase
- secrets collect on contact
- gate opens after 3 secrets
- win works
- loss works
- restart works
- mute and volume work
- local static server works
- direct file open works
- no console-breaking errors

## Packaging
Final ZIP contains the `masquerade-game` directory only, with static files:
- `index.html`
- `styles.css`
- `game.js`
- `IMPLEMENTATION_SPEC.md`
