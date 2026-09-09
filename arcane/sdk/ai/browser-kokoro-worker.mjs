import {
  installBrowserSpeechArtifactModuleWorker,
  installBrowserSpeechWorker,
} from "./speech-worker-runtime.mjs?arcaneVersion=0.28.2";

const mode = new URL(import.meta.url).searchParams.get("arcaneSpeechWorkerMode");

if (mode === "artifact-module-worker") {
  installBrowserSpeechArtifactModuleWorker("tts");
} else {
  installBrowserSpeechWorker("tts");
}
