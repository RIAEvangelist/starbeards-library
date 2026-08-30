import {fileURLToPath} from 'node:url';
import {materializeInstalledSdkRuntime} from 'arcane-os';

const workspaceRoot = fileURLToPath(new URL('../', import.meta.url));

await materializeInstalledSdkRuntime({workspaceRoot});
