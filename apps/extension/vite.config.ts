import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync } from 'fs';
import { execSync } from 'child_process';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const copyManifest = (): Plugin => {
  return {
    name: 'copy-manifest',
    closeBundle() {
      copyFileSync(resolve(__dirname, 'manifest.json'), resolve(__dirname, 'dist/manifest.json'));
    },
  };
};

const buildContentScripts = (): Plugin => {
  return {
    name: 'build-content-scripts',
    closeBundle() {
      execSync('BUILD_TARGET=inspector vite build', { stdio: 'inherit', cwd: __dirname });
      execSync('BUILD_TARGET=bridge vite build', { stdio: 'inherit', cwd: __dirname });
    },
  };
};

const buildTarget = process.env.BUILD_TARGET;

const contentScriptConfig = (
  entry: string,
  name: string,
  outFile: string,
): import('vite').UserConfig => {
  return {
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, entry),
        name,
        formats: ['iife' as const],
        fileName: () => outFile,
      },
      target: 'chrome120',
      sourcemap: false,
      minify: true,
    },
    resolve: {
      alias: { '@': resolve(__dirname, 'src') },
    },
  };
};

// noinspection JSDeprecatedSymbols
export default defineConfig(
  buildTarget === 'inspector'
    ? contentScriptConfig('src/content/inspector.ts', 'ClaudeInspector', 'content-inspector.js')
    : buildTarget === 'bridge'
      ? contentScriptConfig(
          'src/content/react-bridge.ts',
          'ClaudeReactBridge',
          'content-react-bridge.js',
        )
      : // ── Main build — also triggers content script builds afterward ────────
        {
          plugins: [react(), tailwindcss(), copyManifest(), buildContentScripts()],
          build: {
            outDir: 'dist',
            emptyOutDir: true,
            rollupOptions: {
              input: {
                'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
                panel: resolve(__dirname, 'src/panel/panel.tsx'),
              },
              output: {
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
                assetFileNames: '[name].[ext]',
              },
            },
            target: 'chrome120',
            sourcemap: false,
            minify: true,
          },
          resolve: {
            alias: { '@': resolve(__dirname, 'src') },
          },
          publicDir: 'public',
        },
);
