# Juliet’s Grand Adventures

A build-free illustrated library starring Juliet, Uni, and Starbeard.

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

The site pins published `arcane-os@0.3.1` and uses its public browser-speech, AI, DBOPFS, event, and `SpeechPlayback` contracts. JuJu owns story narration, voice choice, and presentation; the SDK owns provider registration, loading, cancellation, Worker isolation, WAV normalization, cached artifact materialization, playback, and the single `globalThis.arcaneEvents` authority. The legacy app-local `speech-worker.js`, direct CDN import, AudioContext scheduler, and browser-speech fallback have been retired.

The consumer currently remains fail-closed at the external runtime/model/voice authority boundary. No non-RIA browser speech package, model, voice, or CDN fetch is enabled until that exact selected closure is explicitly authorized. This is an honest pending integration state, not functional speech proof; the visual stories remain available and the UI reports why narration is unavailable.

Every spread has a **Move words** handle. Drag it with a mouse or finger, or focus it and use the arrow keys. Hold Shift for larger keyboard steps, and press Home or **Reset** to restore the original position. **Shrink words** collapses the story panel into a small movable control so the full illustration can be explored; **Show words** restores the text.

## Serve locally

The project directory is:

```text
C:\Users\codex\Documents\ChatGPT\JuJu's Grand Adventures
```

From PowerShell:

```powershell
cd "C:\Users\codex\Documents\ChatGPT\JuJu's Grand Adventures"
py -m http.server 8000
```

Then open `http://127.0.0.1:8000/` in a browser.

The repository pins the local `arcane-os@0.3.1` SDK dependency in `package.json` and `package-lock.json`. The site still has no build step, framework, backend, or server-side database; it uses `index.html`, `styles.css`, `app.js`, `speech-consumer.mjs`, local files under `assets/`, and the installed SDK’s public browser runtime.

## Privacy

Private family photos were used only as references for the generated picture-book illustrations. The original photos are not copied into this repository or the site assets.

Page narration text is not sent to a provider while speech authority is unavailable. No speech runtime, model, voice, or CDN asset is downloaded by the current consumer, and there is no native or cloud fallback.
