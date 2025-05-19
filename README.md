# Project To Text - VS Code Extension

Convert your VS Code workspace into a formatted text file with an organized directory structure and file contents. Perfect for sharing code with AI assistants, documentation, or code reviews.

## Features

- 📁 **Complete Directory Tree**: Displays the full structure of your project
- 📄 **Selective File Inclusion**: Choose which files to include fully vs preview-only
- 🚫 **Smart Exclusions**: Automatically respects .gitignore and excludes common build/cache directories
- 🎯 **Flexible Selection**: GUI multi-select or text-based input for file selection
- 📋 **Clipboard Ready**: Output is automatically copied to your clipboard
- ⚙️ **Configurable**: Customize preview lines, tree depth, and exclusion patterns

## Usage

Run the command `Project To Text: Convert Project` from:
- Command Palette (`Ctrl/Cmd + Shift + P`)
- Keyboard shortcut (if configured)

### Input Methods

1. **GUI Selection** (Recommended)
   - Multi-select checkboxes for files and folders
   - Visual icons to distinguish files (📄) from folders (📁)
   - Search/filter capability
   - Space to select, Enter to confirm

2. **Text Input**
   - Enter comma-separated list: `README.md, package.json, src/`
   - Leave empty to include all files fully

### Output Format

```
Directory structure:
└── project-root/
    ├── src/
    │   └── index.js
    └── package.json

Files Content:

================================================
FILE: src/index.js (fully included)
================================================
[full content here]

================================================
FILE: package.json (preview only)
================================================
{
  "name": "my-project",
  "version": "1.0.0",
...
[FILE TRUNCATED - showing 5 of 25 lines]
```

## Extension Settings

This extension contributes the following settings:

* `projectToText.maxTreeDepth`: Maximum depth for directory tree display (default: 10, 0 = unlimited)
* `projectToText.customExclusions`: Additional patterns to exclude from directory tree and file processing (default: [])
* `projectToText.previewLines`: Number of lines to show in file preview (default: 5)

### Default Exclusions

The extension automatically excludes common build artifacts and cache directories:
- `node_modules`, `.git`, `.dart_tool`, `.idea`, `.vscode`
- Build outputs: `out`, `dist`, `build`, `target`
- Lock files: `package-lock.json`, `yarn.lock`, `pubspec.lock`
- Cache directories: `.cache`, `.next`, `__pycache__`
- And many more...

Files and directories matching patterns in `.gitignore` are also automatically excluded.

## Examples

### GUI Selection Mode
- Visual file browser with icons (📁 folders, 📄 files)  
- Multi-select with checkboxes
- Search/filter functionality
- Space to select, Enter to confirm

### Text Input Mode
- `README.md, package.json, src/` - Includes these items fully
- Leave empty to include all files fully
- Folders must end with `/`

## Requirements

- VS Code 1.100.0 or higher
- An open workspace folder

## Installation

1. Install from VS Code Marketplace (coming soon)
2. Or install from VSIX file:
   ```bash
   code --install-extension project-to-text-0.0.1.vsix
   ```

## Known Issues

- Large projects may take a moment to process
- Binary files are not included in the output

## Release Notes

### 0.0.1

Initial release:
- Basic project to text conversion
- GUI and text-based file selection  
- Directory tree generation
- File content inclusion with preview mode
- .gitignore support
- Configurable settings for depth, exclusions, and preview lines
- Smart default exclusions for common build artifacts

---

**Enjoy converting your projects to text! 🚀**