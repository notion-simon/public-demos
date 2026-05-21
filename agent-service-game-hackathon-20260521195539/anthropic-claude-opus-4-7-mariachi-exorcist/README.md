# Mariachi Exorcist

A client-only rhythm game. You're a mariachi exorcist. Three ghosts haunt San Sepulcro. Strum on the beat to put them to rest.

## Play
Open `index.html` in a modern browser, or host the folder on GitHub Pages.

## Controls
- **A / S / D** — three lanes
- **M** — mute / unmute
- **Esc** — pause / resume
- **Mouse** — tap the lane buttons works too

## How to play
1. Notes fall in three lanes.
2. Press the matching key as a note crosses the **strum line**.
3. Hits fill your **Spirit** bar. Misses fill the ghost's **Haunt** bar.
4. Fill Spirit first → the ghost is banished. Fill Haunt first → the ghost overwhelms you (retry the same ghost).
5. Banish all three ghosts to free the town.

## Tech
Pure HTML / CSS / JS. Single `<canvas>` for the scene. Web Audio API generates all instruments (guitar, vihuela, trumpet, bass, percussion) — no external audio files. Drop the folder into any static host.
