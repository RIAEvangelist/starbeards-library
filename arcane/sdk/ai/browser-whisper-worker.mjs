import {
  installBrowserSpeechArtifactModuleWorker,
  installBrowserSpeechWorker,
} from "./speech-worker-runtime.mjs?arcaneVersion=0.5.17";

const mode = new URL(import.meta.url).searchParams.get("arcaneSpeechWorkerMode");

if (mode === "artifact-module-worker") {
  installBrowserSpeechArtifactModuleWorker("stt");
} else {
  installBrowserSpeechWorker("stt");
}
