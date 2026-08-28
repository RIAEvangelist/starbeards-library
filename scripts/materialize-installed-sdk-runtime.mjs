import {materializeInstalledSdkRuntime} from 'arcane-os';
import {fileURLToPath} from 'node:url';

const workspaceRoot=fileURLToPath(new URL('../',import.meta.url));
const result=await materializeInstalledSdkRuntime({workspaceRoot});

process.stdout.write(`${JSON.stringify({
    kind:result.kind,
    status:result.status,
    generation:result.generation,
    sdkVersion:result.installation.packageVersion,
    fileCount:result.workspaceRuntimeReceipt.fileCount,
    totalBytes:result.workspaceRuntimeReceipt.totalBytes,
    contentSha256:result.workspaceRuntimeReceipt.contentSha256,
    cleanupWarnings:result.cleanupWarnings
})}\n`);
