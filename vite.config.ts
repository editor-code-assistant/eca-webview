import react from '@vitejs/plugin-react';
import { resolve } from "path";
import { defineConfig } from 'vite';

const vendorGroups = {
  'vendor-react': [
    'react',
    'react-dom',
    'react-router',
    'react-router-dom',
    'scheduler',
    'use-sync-external-store',
  ],
  'vendor-state': [
    '@reduxjs/toolkit',
    'immer',
    'react-redux',
    'redux',
    'redux-thunk',
    'reselect',
  ],
  'vendor-motion': [
    'framer-motion',
    'motion-dom',
    'motion-utils',
  ],
  'vendor-markdown': [
    'react-markdown',
    'remark-gfm',
    'unified',
    'micromark',
    'mdast-util',
    'hast-util',
    'unist-util',
    'vfile',
  ],
} as const;

function vendorChunk(id: string): string | undefined {
  const normalizedId = id.replaceAll('\\', '/');
  if (!normalizedId.includes('/node_modules/')) return undefined;

  for (const [chunk, packages] of Object.entries(vendorGroups)) {
    if (packages.some(packageName => normalizedId.includes(`/node_modules/${packageName}/`))) {
      return chunk;
    }
  }
  return undefined;
}

export default defineConfig({
  base: './',
  root: __dirname,
  plugins: [react()],
  build: {
    rollupOptions: {
      // Rolldown's timing heuristic accumulates concurrent hook wait time and
      // flags Vite's built-in CSS plugins on clean Windows builds even after
      // every stylesheet is static CSS. Keep all correctness checks enabled,
      // but disable this non-actionable performance estimate; bundle budgets
      // and warning-free production builds remain enforced independently.
      checks: {
        pluginTimings: false,
      },
      input: {
        index: resolve(__dirname, "index.html"),
      },
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
        manualChunks: vendorChunk,
      },
    },
    manifest: true,
  },
  server: {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["*", "Content-Type", "Authorization"],
      credentials: true,
    },
  }
})

