# Juliet’s Grand Adventures

An illustrated Arcane browser application starring Juliet, Uni, and Starbeard.

## Library sections

Only completed books are added to the library. Each finished book belongs to one of three sections and gives every story page its own relevant illustration; page art is not reused within a book.

### Juliet’s Grand Adventures

- **The Three Little Planets:** an eight-spread journey guided by the magical map hidden in Starbeard’s beard.
- **Starbeard and the Doughnut Planet Map:** an eight-spread rescue guided by the golden map hidden in Juliet’s marmalade, with Starbeard becoming more space-pirate-like along the way.
- **Starbeard and the Starwater:** an eight-spread treasure hunt about preparing carefully, digging patiently, sharing clear cosmic water, and carrying kindness home.

### The Adventures of Starbeard and Uni

- **Book One — The Song of the Moonlit Blossom Planet:** a complete twenty-one-page, individually illustrated tale of a missing note, a singing forest, and the friendship hidden inside every true treasure.
- **Book Two — The Great Galactic Sock Caper:** a complete twelve-page, individually illustrated laundry-day mystery about recovering slowly, following silver clues, rescuing the wrong sock, and finding an adventure exactly big enough for today.
- **Book Three — The Treasure of Pluto and the Luminous Labyrinth:** a ten-page journey through frozen treasure caverns, the Festival of Light, the Celestial Isles, and a maze made from memories.

### Other Stories

Completed stories outside the two adventure collections will be added here.

Each book opens in the same full-screen horizontal reader with touch swiping, keyboard navigation, page controls, and JuJu’s existing eight-voice read-aloud controls.

The app pins published `arcane-os@0.3.1` and uses its public browser-speech, AI, DBOPFS, event, and `SpeechPlayback` contracts. JuJu owns story narration, voice choice, and presentation; the SDK owns provider registration, loading, cancellation, Worker lifecycle, WAV normalization, runtime asset loading, playback, and the single `globalThis.arcaneEvents` authority. The legacy app-local `speech-worker.js`, direct CDN import, AudioContext scheduler, and browser-speech fallback have been retired.

No external browser speech runtime, model, voice, or CDN source is configured because that dependency closure has not been authorized. This is an honest pending integration state, not functional speech proof; the visual stories remain available and the UI reports why narration is unavailable.

Every spread has a **Move words** handle. Drag it with a mouse or finger, or focus it and use the arrow keys. Hold Shift for larger keyboard steps, and press Home or **Reset** to restore the original position. **Shrink words** collapses the story panel into a small movable control so the full illustration can be explored; **Show words** restores the text.

## Arcane island boundary

JuJu declares exact `arcane-os@0.3.1` in its own `package.json`; a normal project-root `npm install` resolves the public package into this repository’s own physical `node_modules`. Application source lives under `apps/juju-grand-adventures/`, and the installed SDK runtime is materialized under the repository-local `arcane/` projection. No global install, symlink, Arcane checkout, live source mount, or update poll is part of the package or runtime contract.

Create the one selected, independently runnable browser artifact with:

```powershell
npm run package
```

That command packages JuJu with its checked-in installed SDK projection, managed import map, complete runtime/browser closure, and Arcane licensing into `dist/juju-grand-adventures/`. The generated release remains browser-only and does not claim a native launcher or publisher signature.

## Serve locally

The project directory is:

```text
C:\Users\codex\Documents\ChatGPT\JuJu's Grand Adventures
```

Install and start the app from PowerShell:

```powershell
cd "C:\Users\codex\Documents\ChatGPT\JuJu's Grand Adventures"
npm install
npm run dev
```

Open the loopback URL printed by the SDK development server. The app has no framework, backend, or server-side database; it uses plain HTML, CSS, and JavaScript plus local media under `apps/juju-grand-adventures/assets/`.

## Privacy

Private family photos were used only as references for the generated picture-book illustrations. The original photos are not copied into this repository or the site assets.

Page narration text is not sent to a provider while speech authority is unavailable. No speech runtime, model, voice, or CDN asset is downloaded by the current consumer, and there is no native or cloud fallback.
