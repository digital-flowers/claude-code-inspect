# Claude Code Inspect Coding Guidelines

This document outlines the coding standards and best practices for the Claude Code Inspect project. These rules have been established to ensure consistency, performance, and compatibility across the monorepo.

## 1. Arrow Functions
- **Preference**: Use arrow functions for all function declarations, including React components and utility functions.
- **Shorthand Syntax**: Use shorthand arrow functions (implicit returns) whenever a function contains only a single return statement and no preceding logic.
  - *Correct*: `const add = (a, b) => a + b;`
  - *Incorrect*: `const add = (a, b) => { return a + b; };`

## 2. Exports
- **Inline Exports**: Export variables, constants, and components directly at their declaration.
- **Avoid Export Blocks**: Do not use `export { ... }` blocks at the end of files.
  - *Correct*: `export const MyComponent = () => ...`
  - *Incorrect*: `const MyComponent = () => ...; export { MyComponent };`

## 3. React Imports
- **Named Imports**: Always use named imports from the `react` package.
- **Avoid Namespace Imports**: Do not use `import * as React from 'react'`.
  - *Correct*: `import { useState, type ComponentProps } from 'react';`
  - *Incorrect*: `import * as React from 'react';`

## 4. Image Handling & Performance
- **Compression**: Screenshots sent from the extension must be resized to a maximum of 1024x1024 pixels.
- **Format**: Use `image/jpeg` with a quality setting of `0.8` to balance visual clarity and token usage.
- **Implementation**: Utilize the `resizeImage` utility in `apps/extension/src/panel/lib/resizeImage.ts`.

## 5. MCP & Claude Channel Protocol
- **Content Format**: When sending notifications via `notifications/claude/channel`, the `content` parameter must be a single **string**.
- **Contextual Data**: Append metadata and compressed image base64 strings directly to the message content string, as the current experimental protocol primarily supports string-based delivery.

## 6. Project Structure & Module Resolution
- **Monorepo**: Follow the established `apps/extension` and `apps/plugin` structure.
- **Styling**: Use Tailwind CSS 4 for all UI components in the extension.
- **Icons**: Use Lucide React for consistent iconography.
- **Imports**: Omit file extensions in TypeScript imports (e.g., `import { X } from './utils'`) to leverage `moduleResolution: "bundler"`. Do not use `.js` or `.ts` extensions in import paths.
