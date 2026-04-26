# Privacy Policy — Claude Code Inspect

**Last updated: April 18, 2026**

## Overview

Claude Code Inspect is a Chrome browser extension that lets you click any element on any webpage and send its context to a locally running Claude Code instance for analysis.

## Data Collection

**We collect no data.** Claude Code Inspect does not collect, store, transmit, or share any personal information or browsing data with any third-party server.

## How the Extension Works

When you inspect an element, the extension:

1. Captures the selected DOM element's context (selector, HTML, computed styles, and an optional screenshot) from the active tab.
2. Sends that context **only** to the Claude Code plugin server running locally on your own machine (`localhost:9999`).
3. No data ever leaves your device to any external server controlled by the extension author.

## Permissions Used

| Permission     | Why it's needed                                          |
|----------------|----------------------------------------------------------|
| `activeTab`    | Read the currently active tab to capture element context |
| `scripting`    | Inject the inspector and React bridge into the page      |
| `contextMenus` | Provide a right-click "Inspect with Claude" menu option  |
| `storage`      | Persist inspected element state across side panel opens  |
| `tabs`         | Track active tab changes and clean up per-tab state      |
| `sidePanel`    | Render the side panel UI                                 |
| `<all_urls>`   | Users can inspect elements on any website                |

## Third-Party Services

This extension does not integrate with any analytics, advertising, or tracking services.

## Contact

If you have questions about this privacy policy, open an issue at:  
[https://github.com/digital-flowers/claude-code-inspect/issues](https://github.com/digital-flowers/claude-code-inspect/issues)
