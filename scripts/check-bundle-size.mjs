import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const maximumChunkBytes = 500 * 1024;
const distributionDirectory = resolve('dist');
const manifestPath = resolve(distributionDirectory, '.vite', 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const chunkFiles = [...new Set(
    Object.values(manifest)
        .map(entry => entry.file)
        .filter(file => file.endsWith('.js')),
)];

if (chunkFiles.length === 0) {
    throw new Error('Bundle manifest contains no JavaScript chunks');
}

const chunks = await Promise.all(chunkFiles.map(async file => ({
    file,
    bytes: (await stat(resolve(distributionDirectory, file))).size,
})));
const oversized = chunks.filter(chunk => chunk.bytes > maximumChunkBytes);

if (oversized.length > 0) {
    const details = oversized
        .sort((left, right) => right.bytes - left.bytes)
        .map(chunk => `${chunk.file}: ${(chunk.bytes / 1024).toFixed(2)} kB`)
        .join('\n');
    throw new Error(`Bundle chunks exceed the 500 kB budget:\n${details}`);
}

const largest = chunks.reduce((current, chunk) => chunk.bytes > current.bytes ? chunk : current);
console.log(`Bundle budget passed: ${chunks.length} chunks, largest ${largest.file} at ${(largest.bytes / 1024).toFixed(2)} kB`);
