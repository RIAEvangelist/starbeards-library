![Juliet, Uni, and Starbeard beneath three glowing planets, with the title Juliet’s Grand Adventures.](assets/social-card.png)

# Juliet’s Grand Adventures

An illustrated Arcane browser application starring Juliet, Uni, and Starbeard, currently in development toward its first production release.

[GitHub Pages app — deployment pending](https://riaevangelist.github.io/starbeards-library/)

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

- **Before He Was Admiral Pigeon, Book One — The Little Pigeon in the Great Stone Wall:** twelve complete illustrated chapters plus cover, following Pigeon from his family's home in an ancient warrior-pigeon cave to his first great Airforce rescue.
- **Before He Was Admiral Pigeon, Book Two — The Pigeon Beyond the Sky:** twelve complete illustrated chapters plus cover, following his transfer to the Galactic Pigean Space Corps and a convoy rescue through an Iron Talon blockade.
- **Before He Was Admiral Pigeon, Book Three — Admiral of the Pigeon's Poop Deck:** twelve complete illustrated chapters plus cover, following the Great War, Pigeon's earned appointment, and his first assignment as admiral. Read the trilogy before **The Runaway Cup**.
- **Captain Star Beard & Admiral Pigeon: Adventures in the Prism Galaxy — The Runaway Cup:** a complete twenty-four-page prequel plus cover about their first meeting, a frightened new magical AI cup, a climb up an enormous ancient crystal, and the friendship that brings everyone home. Every story page has its own illustration. Young Star Beard's appearance draws on Roshi's supplied younger photographs; the original photos remain outside the repository.

Each book opens in the same full-screen horizontal reader with touch swiping, keyboard navigation, page controls, and JuJu’s read-aloud controls and browser voice selection.

## Meet the characters

The library's **Meet the characters** link opens an illustrated field guide with 69 character and community profiles across all ten stories. Search by name or description, filter by story, follow relationships, or open a character's books directly. Each profile has a stable `#character/<id>` address, such as `#character/admiral-pigeon`; the full directory is at `#characters`.

**In the stories** records the established fictional history. **Beyond the pages** supplies new backstory written to extend that history. Unnamed participants retain descriptive labels; passing crews and briefly mentioned neighbors have collective entries preserving their individual source roles. The expandable references record exact pages or chapters and unresolved differences between prose and illustrations. Profiles contain story endings.

The [shared canon](manuscripts/canon/README.md) owns the character records, [source coverage](manuscripts/canon/coverage.md), and [world and chronology guide](manuscripts/canon/world-and-chronology.md). The browser loads its four JSON inventories concurrently on first use. Existing story illustrations supply the profile art; full comic editions and private photographic references are not part of this website update.

The Admiral Pigeon trilogy preserves the [complete reading manuscripts](manuscripts/admiral-pigeon-origins/README.md), including all paragraphs and emphasis. Each chapter occupies one illustrated page with vertically scrolling text. Focus the text area to use Page Up, Page Down, Home, or End within the chapter; left and right arrows still turn pages. Move words and Shrink words remain outside the scrolling text. Its thirty-nine illustrations and scene descriptions are recorded in the [Book One](manuscripts/admiral-pigeon-origins/illustrations/book-1.json), [Book Two](manuscripts/admiral-pigeon-origins/illustrations/book-2.json), and [Book Three](manuscripts/admiral-pigeon-origins/illustrations/book-3.json) art manifests.

The app pins published `arcane-os@0.52.1` and uses its public `createBrowserSpeechSynthesisProvider` and `SpeechPlayback` contracts for the browser's Web Speech API.

JuJu defaults to **Google US English**, then another available Google English voice, then the browser's default English voice or first English voice. If no English voice is listed, the browser chooses its default. The Voice menu contains the browser's complete current inventory and updates when voices become available. A reader's explicit selection takes precedence and is saved by voice URI under `juju-grand-adventures.web-speech-voice`; the previous Kokoro preference remains untouched.

**Read this page** speaks the current page, in passage order, at 0.95 speed. The browser voice handles punctuation and pronunciation. JuJu retains the 200 ms pause between passages and adds none after the final passage. The SDK owns native utterances, ordered playback, lookahead, completion, cancellation, and voice-list events. Only the final spoken passage's completion returns the reader to ready. Stop reading, page navigation, changing books or voices, returning to the library, and leaving the page stop narration. Failed speech leaves the full visual story available with a retry action.

Native Web Speech produces playback, not downloadable audio files. There is no app-managed parallel model rendering, whole-book background generation, or new DBOPFS audio caching. Existing `juju_narration_audio` records are neither read nor deleted. The app no longer loads Kokoro, Transformers, phonemizer, ONNX, or model/voice files for narration, and no longer initializes AI or migrates AI preferences for this feature. There is no persisted conversation or model-authored chat.

JuJu owns the selected page, voice preference, passage pauses, and reader UI. The shared SDK implementation remains package-owned, with no copied worker or app-local speech provider. The existing Arcane theme and theme bootstrap remain unchanged.

JuJu's narration collector preserves complete DOM text and punctuation, including whitespace. On a detached clone it represents authored `<br>` elements as newlines so words on separate visual lines do not join; it does not rewrite the story document. `inspect()` exposes the native provider status, playback state, and actual voice inventory for developer diagnostics.

Every spread has a **Move words** handle. Drag it with a mouse or finger, or focus it and use the arrow keys. Hold Shift for larger keyboard steps, and press Home or **Reset** to restore the original position. **Shrink words** collapses the story panel into a small movable control so the full illustration can be explored; **Show words** restores the text.

## Standalone application layout

JuJu declares exact `arcane-os@0.52.1` in its own `package.json`; a normal project-root `npm install` resolves the public package into this repository’s own `node_modules`. App source, descriptors, manifest, and `assets/` live at the repository root. The four documented `installed-v1` routes in `arcane-packager.json` serve the actual installed SDK runtime, browser runtime, runtime dependency, and license files. Runtime and packaging no longer use the obsolete root `arcane/` projection. The physical-runtime materializer is retired; there is no global install, symlink, checkout dependency, or update poll. Public `arcane-os` imports resolve through the SDK-generated map using stable resource URLs without SDK-generated cache suffixes. App-owned functional queries and fragments are preserved; existing conditional HTTP requests and application caches remain in use.

The workspace uses `appsRoot: "."`. The SDK’s standalone-root flow generates no nested app navigation pages, redirects, or duplicate PWA files, and has no setting to retain them. Roshi explicitly retired both the old `arcane` and `apps` redirect families on September 9, 2026. Keep those redirects, aliases, and copied trees retired; do not restore them through a generator default, host rule, or compatibility file. Open `/` when serving this repository as a host root, or `/starbeards-library/` on the intended GitHub Pages host. The former `/apps/juju-grand-adventures/` entry is retired.

The application ID remains `juju-grand-adventures`. The manifest explicitly retains its former implicit installation ID, `./apps/juju-grand-adventures/index.html`, while its launch URL is `./index.html`; that ID is an identifier, not a redirect or a required resource. Previously saved same-origin DBOPFS data remains untouched. Neither the root layout nor the Web Speech change clears, moves, or rewrites it.

### Committed generated files

After changing the SDK dependency or app resource selection, prepare the managed root files locally through the public SDK operation, review the source diff, and commit them with the source:

```powershell
npm run import-map
```

Commit `modules/arcane.importmap.json`, the managed map and resource references in `index.html`, and `arcane-package.json` alongside its authored `arcane-app.json`. Do not hand-edit managed maps or copy SDK source. Ordinary deployment uses the committed app files plus the normal locked npm installation. Future Actions workflows must copy, archive, or deploy committed inputs without invoking import-map, materialization, offline generation, or an indirect generation hook. This repository currently has no Actions workflows to modify.

JuJu has not enabled the SDK's optional PWA behavior in its app descriptor. The SDK update does not register a PWA worker, mount an installation prompt, or change the app's branding. Browser speech availability is independent of PWA enablement.

Create the one selected, independently runnable browser artifact with:

```powershell
npm run package
```

That explicitly selected operation creates portable output in `dist/juju-grand-adventures/` from the committed app selection and installed npm routes, including the complete selected SDK runtime/browser closure and licensing. It is an output generator, not an ordinary deployment step. `npm run bundle` archives existing selected output; `npm run run` serves existing selected output. These commands do not prepend managed-file regeneration. The generated release remains browser-only and uses the device/browser's available speech voices. Existing ignored `dist/` output is separate from current root source and remains unchanged until packaging is explicitly selected.

## Serve locally

The project directory is:

```text
C:\Users\codex\Documents\ChatGPT\JuJu's Grand Adventures
```

Use Node.js 22.23.2 or newer. The SDK supplies `node-http-server@10.0.0` through its runtime dependency tree; JuJu declares no separate server dependency. For the default HTTPS mode, supply the workspace's PEM certificate chain at `.arcane/dev/server-cert.pem` and private key at `.arcane/dev/server-key.pem`, or pass the SDK's `--cert` and `--key` options with existing paths. These local files are ignored by Git. PEM-backed HTTPS supports HTTP/2 and HTTP/1.1 on the same port, with a paired HTTP 308 redirect listener; certificate creation and device trust setup are not performed by JuJu.

With that pair configured, install and start the app from PowerShell:

```powershell
cd "C:\Users\codex\Documents\ChatGPT\JuJu's Grand Adventures"
npm install
npm run dev
```

For explicit HTTP source development without a certificate pair, use the same public SDK server:

```powershell
npm run dev -- --http --port 8001
```

This selects one HTTP content listener without an HTTPS listener or redirect. Use an available port; do not start a second server on a port already owned by a running server. Open the URL printed by the SDK development server. SDK source-development startup manages its own map refresh; deployment does not invoke this development command. Browser storage belongs to the exact scheme, host, and port: changing from an existing HTTP address to HTTPS opens separate storage and does not migrate or delete the old origin's prepared narration. Voice preferences are also origin-specific. DBOPFS and PWA availability remain subject to browser secure-context requirements, particularly when using a plain HTTP LAN address. The app has no framework, backend, or server-side database; it uses plain HTML, CSS, and JavaScript plus local media under `assets/`.

## Privacy

Private family photos were used only as references for the generated picture-book illustrations. The original photos are not copied into this repository or the site assets.

Narration uses the selected browser voice. Voices marked as remote by the browser may send text to their speech service and require a network connection; Web Speech is not a promise of offline or local-only processing. JuJu stores only the selected voice preference for this feature and does not record speech audio or conversation history. See the [Web Speech API voice contract](https://webaudio.github.io/web-speech-api/#speechsynthesisvoice).
