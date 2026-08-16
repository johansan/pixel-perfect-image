import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve the repo root so the obsidian alias points at the local stub
const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            obsidian: path.resolve(dirname, 'tests/stubs/obsidian.ts')
        }
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            reportsDirectory: 'coverage'
        }
    }
});
