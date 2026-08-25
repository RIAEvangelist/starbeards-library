# Juliet’s Grand Adventures

A build-free illustrated library starring Juliet, Uni, and Starbeard.

## Library sections

Only completed books are added to the library. Each finished book belongs to one of three sections.

### Juliet’s Grand Adventures

- **The Three Little Planets:** an eight-spread journey guided by the magical map hidden in Starbeard’s beard.
- **Starbeard and the Doughnut Planet Map:** an eight-spread rescue guided by the golden map hidden in Juliet’s marmalade, with Starbeard becoming more space-pirate-like along the way.

### The Adventures of Starbeard and Uni

- **Book One — The Song of the Moonlit Blossom Planet:** the complete twenty-one-page tale of a missing note, a singing forest, and the friendship hidden inside every true treasure.
- **Book Three — The Treasure of Pluto and the Luminous Labyrinth:** a ten-spread journey through frozen treasure caverns, the Festival of Light, the Celestial Isles, and a maze made from memories.

### Other Stories

- **Starbeard and the Starwater:** an eight-spread treasure hunt about preparing carefully, digging patiently, sharing clear cosmic water, and carrying kindness home.

Each book opens in the same full-screen horizontal reader with touch swiping, keyboard navigation, page controls, and optional local Kokoro read-aloud. The voice menu beside **Read this page** offers American and British voices and remembers the selected voice in that browser.

Kokoro loads only after **Read this page** is pressed. On first use, the browser downloads the pinned `kokoro-js@1.2.1` web bundle, its ONNX Runtime Web WASM dependencies, the Kokoro q8 model (roughly 92 MB), and the selected voice data; browser caching makes later reads lighter. Speech is generated locally in a dedicated browser worker. If Kokoro cannot run or download, the reader falls back to the browser’s built-in speech voice when available.

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

There is no package manager, build step, framework, backend, database, or local module installation. The site uses `index.html`, `styles.css`, `app.js`, `speech-worker.js`, local files under `assets/`, and the pinned browser-loaded Kokoro runtime described above.

## Privacy

Private family photos were used only as references for the generated picture-book illustrations. The original photos are not copied into this repository or the site assets.

Page narration text stays in the browser and is synthesized locally after the runtime/model files are downloaded from jsDelivr and Hugging Face.
