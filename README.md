# Juliet’s Grand Adventures

An illustrated, read-together storybook starring Juliet, Uni, and Starbeard. “The Three Little Planets” is presented as a full-screen horizontal reader with touch scrolling, keyboard navigation, page controls, and optional browser read-aloud.

## Local development

```powershell
npm install
npm run dev
```

Create the selected Sites release output with:

```powershell
npm run build
```

## Architecture and privacy

- The experience uses plain HTML, CSS, and JavaScript. There is no TypeScript, TSX, React, database, or application state service.
- The story, illustrations, reading controls, and speech-synthesis enhancement are specific to this standalone storybook. No Arcane OS or Arcane SDK shared-runtime capability is changed or duplicated.
- Private family photos were used only as off-site image-generation references. The original photos are not copied into this repository or its deployable assets.
- Published artwork is AI-generated picture-book illustration stored under `public/assets/`.
