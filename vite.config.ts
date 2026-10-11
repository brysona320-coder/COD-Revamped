import { defineConfig } from 'vite';

// Relative URLs make the same build work at / and /repository-name/ on GitHub Pages.
export default defineConfig({ base: './', build: { target: 'es2022' } });
