# Project To Text - VS Code Extension

## Overview

This VS Code extension converts open workspace projects into formatted text files, similar to GitIngest but with the following key features:

1. Works with any open folder in VS Code
2. Allows selective file/folder inclusion with full content
3. Non-selected files show only preview (first few lines) with truncation indicator
4. Always includes complete directory structure
5. Opens output in a new VS Code editor tab
6. Binary files (images, videos, etc.) appear in directory tree but content is excluded

## Usage

Extension provides two commands:
1. **Project To Text: Convert Project** - Standard conversion with full file contents
2. **Project To Text: Convert Project (Concise Mode)** - Shows only essential code elements (imports, exports, function/class signatures, comments)

Commands can be activated via:
- Command palette
- Keyboard shortcut
- Command line (if parameters needed)

### Input Options

When activated, users have two options:

1. **GUI Selection** (NEW):
   - Multi-select interface with checkboxes
   - Shows all files and folders in the workspace
   - Uses icons to distinguish files (📄) from folders (📁)
   - Search/filter capability built-in
   - Space to select, Enter to confirm

2. **Text Input** (Original):
   - Comma-separated format: `README.md, package.json, src/`
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

1. ✅ Replace "Hello World" command with "Project To Text"
2. ✅ Implement file/folder selection dialog or command input
3. ✅ Create directory tree builder
4. ✅ Implement file content processor (full vs preview)
5. ✅ Format output and copy to clipboard
6. ✅ Add GUI selection mode with multi-select QuickPick
7. ✅ Add configuration for preview line count
8. ✅ Implement .gitignore support for exclusions
9. ✅ Add comprehensive default exclusions for build artifacts
10. ✅ Add configurable max directory tree depth
11. ✅ Add configurable custom exclusion patterns

## Configuration

The extension provides several configuration options:

- `projectToText.maxTreeDepth`: Maximum depth for directory tree (default: 10, 0 = unlimited)
- `projectToText.customExclusions`: Additional patterns to exclude (default: [])
- `projectToText.previewLines`: Number of preview lines for non-selected files (default: 5)

## Default Exclusions

Automatically excludes:
- Version control: `.git`, `.svn`, `.hg`
- Build outputs: `node_modules`, `dist`, `build`, `out`, `target`
- IDE files: `.idea`, `.vscode`
- Cache directories: `.cache`, `.next`, `__pycache__`
- Lock files: `package-lock.json`, `yarn.lock`, `pubspec.lock`
- Language-specific: `.dart_tool`, `.gradle`, `.eggs`, `*.pyc`
- Temporary files: `*.log`, `*.tmp`, `*.temp`
- And respects `.gitignore` patterns

## Development Commands

- `npm run compile`: Compile TypeScript
- `npm run watch`: Watch mode compilation
- `npm run lint`: Run ESLint
- `npm run test`: Run tests

## Testing

Press F5 to launch extension in development mode.