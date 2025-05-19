# Project To Text - VS Code Extension

## Overview

This VS Code extension converts open workspace projects into formatted text files, similar to GitIngest but with the following key features:

1. Works with any open folder in VS Code
2. Allows selective file/folder inclusion with full content
3. Non-selected files show only preview (first few lines) with truncation indicator
4. Always includes complete directory structure
5. Copies output directly to clipboard

## Usage

Extension can be activated via:
- Command palette
- Keyboard shortcut
- Command line (if parameters needed)

### Input Options

When activated, users can specify files/folders to include fully:
- Format: `README.md, package.json, src/`
- If no input provided, includes all files fully

### Output Format

```
Directory structure:
└── project-root/
    ├── file1.js
    ├── file2.js
    └── src/
        └── index.js

Files Content:

================================================
FILE: file1.js (fully included)
================================================
[full content here]

================================================
FILE: file2.js (preview only)
================================================
// First few lines of code
const example = true;
...
[FILE TRUNCATED - showing 5 of 150 lines]
```

## Implementation Plan

1. Replace "Hello World" command with "Project To Text"
2. Implement file/folder selection dialog or command input
3. Create directory tree builder
4. Implement file content processor (full vs preview)
5. Format output and copy to clipboard
6. Add configuration for preview line count

## Development Commands

- `npm run compile`: Compile TypeScript
- `npm run watch`: Watch mode compilation
- `npm run lint`: Run ESLint
- `npm run test`: Run tests

## Testing

Press F5 to launch extension in development mode.