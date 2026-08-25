import { copyFile, mkdir } from 'node:fs/promises';

const sourceFile = new URL('../server/index.js', import.meta.url);
const serverDirectory = new URL('../dist/server/', import.meta.url);
const outputFile = new URL('../dist/server/index.js', import.meta.url);

async function prepareSitesOutput() {
    await mkdir(serverDirectory, { recursive: true });
    await copyFile(sourceFile, outputFile);
}

await prepareSitesOutput();
