# Mariachi Exorcist

A client-only rhythm game. You're a mariachi exorcist. Three ghosts haunt San Sepulcro. Strum on the beat to put them to rest.

Every run is different.

## Play
Open `index.html` in a modern browser, or host the folder on GitHub Pages.

## Controls
- **A / S / D** — three lanes (low strum / chord / trumpet)
- **M** — mute / unmute
- **Esc** — pause / resume
- **Mouse** — tap the lane buttons works too

## How to play
1. Notes fall in three lanes.
2. Press the matching key as a note crosses the **strum line**.
3. Hits fill your **Spirit** bar. Misses and wrong-key strikes fill the ghost's **Haunt** bar.
4. Fill Spirit first → the ghost is banished. Fill Haunt first → retry the same ghost.
5. Banish all three to free the town.

## What varies between runs
- **Ghost order** is randomized — any of the three ghosts can be the opener, the middle, or the finale.
- **Difficulty tier** scales by slot: opener is gentlest, finale is hardest. The same ghost feels very different depending on which slot they appear in.
- **Modifier moods** — each ghost has 4 possible moods that night (e.g. *"Tonight she weeps softly"*, *"Tonight he stalks the trail"*, *"Tonight she calls the dead"*). The mood changes tempo, density, chord frequency, and rhythmic feel — and is displayed above the count-in.
- **Chord progressions** — each ghost has 4 progression variants. The audio bed loop changes.
- **Trumpet melody hooks** — each ghost has 3 trumpet melodic variants.
- **Note charts** — generated from a per-run seed, so even the same ghost in the same slot will play different patterns each run.

The core mechanic — A / S / D on the beat — stays the same.

## Tech
Pure HTML / CSS / JS. Single `<canvas>`. Web Audio API generates all instruments (guitar, vihuela, trumpet, bass, kick, shaker, clap) live — no external audio files. Drop the folder into any static host.
