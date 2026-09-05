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

The app pins published `arcane-os@0.5.16` and uses its public browser-speech, AI, DBOPFS, and event contracts. JuJu owns story text, voice choice, presentation, and passage pauses. Each Read submits every complete passage on the current page immediately with `AI.streamTTS(text, true, {voice, speed, pauseAfterMs, waitForPlayback: true})`, then awaits the results together. The SDK splits at punctuation, with no four-word cadence, queues generation through its bounded provider pool, and plays the results in original order on its audio clock. Each passage's 200 ms pause follows only its final punctuation chunk; the page's final passage has no added pause.

SDK 0.5.16 defaults to four concurrent Kokoro generation requests with automatic WebGPU-first selection and WASM fallback. Every page passage is submitted before JuJu awaits any passage; later chunks remain in the SDK FIFO until a slot becomes available. No app-side scheduler or synthesis loop waits for playback before submitting more text. SDK capacity does not establish physical GPU kernel overlap, and package installation does not prove actual GPU use or audible browser behavior.

The aggregate read result becomes successful only after the page's final audio ends. Stop and navigation cancel the SDK queue, including generation and scheduled audio. Autoplay recovery calls `AI.resumeAudio()` on the existing queue without submitting the text again. A new Read after completion uses the current page and voice rather than retained old-voice audio. Complete `ai-tts-failure` events feed JuJu's visible error state through `globalThis.arcaneEvents`; each read releases its observer when it settles. There is no persisted conversation or model-authored chat.

The SDK owns provider registration, loading, cancellation, Worker lifecycle, WAV normalization, runtime asset loading, segmentation, and playback. JuJu no longer uses the one-lookahead `SpeechPlayback` wrapper, app-created narration audio element, replay cache, or playback keys. The earlier app-local `speech-worker.js`, direct CDN import, AudioContext scheduler, and browser-speech fallback remain retired.

JuJu's narration collector preserves complete DOM text and punctuation, including whitespace. On a detached clone it represents authored `<br>` elements as newlines so words on separate visual lines do not join; it does not rewrite the story document.

After loading narration, the public `globalThis.ai.providerRuntime.status('tts', {execution: true}).execution` report exposes `requestedDevice`, `selectedDevice`, `maxConcurrentRequests`, and `activeRequestCount`. JuJu's speech consumer includes this report in `inspect().provider.execution`. A selected `webgpu` backend is the provider's report, not proof of physical GPU overlap; `auto` with selected `wasm` reports fallback. The selected device is `null` before loading and after unloading. Inspection errors propagate with the SDK's complete error rather than an inferred device.

Upgrade startup loads the existing public UserEntity preference owner before dynamically importing AI. Only exact uppercase `OPENAI` in saved preference tuple slots 0 and 3 changes to `TWIN`, using the owner's awaited `updateExplicit` operation. Other tuple entries, actual model IDs, voice selections, and history are unchanged; profiles without those markers are not rewritten. A failed migration remains a visible narration initialization error and does not replace preferences or construct a second AI instance.

The SDK package does not include a Kokoro runtime, model, or voice artifact. JuJu supplies its app-owned `kokoro-js@1.2.1` runtime descriptor, selects `onnx-community/Kokoro-82M-v1.0-ONNX` with `fp32`, and defaults to the `af_heart` voice. The SDK loads the runtime and model through its public browser-speech provider and Worker contracts when read aloud is first used. The TTS precision selection is app-owned and does not change the SDK's default four-slot scheduling or any STT configuration.

Every spread has a **Move words** handle. Drag it with a mouse or finger, or focus it and use the arrow keys. Hold Shift for larger keyboard steps, and press Home or **Reset** to restore the original position. **Shrink words** collapses the story panel into a small movable control so the full illustration can be explored; **Show words** restores the text.

## Arcane island boundary

JuJu declares exact `arcane-os@0.5.16` in its own `package.json`; a normal project-root `npm install` resolves the public package into this repository’s own physical `node_modules`. The app-owned ESM materializer projects the installed SDK into the repository-local `arcane/` tree before the public import-map, development, build, bundle, run, or packaging path uses it. No global install, symlink, Arcane checkout, live source mount, or update poll is part of the package or runtime contract. The SDK materializer and managed import-map generator carry `arcaneVersion=0.5.16` through local browser resource references while preserving ordinary caching, remote provider URLs, and saved user state.

Create the one selected, independently runnable browser artifact with:

```powershell
npm run package
```

That command refreshes JuJu’s installed SDK projection and managed import map, then packages the Arcane runtime/browser closure and Arcane licensing into `dist/juju-grand-adventures/`. The generated release remains browser-only; the selected Kokoro runtime, model, and voice assets continue to load from their upstream browser sources when narration is first used.

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

Page narration text is processed locally in the SDK-owned browser Worker. The configured Kokoro runtime, model, and selected voice assets are downloaded and cached in the browser when narration is first used; there is no native or cloud speech fallback.
