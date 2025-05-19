# Project To Text

Convert your VS Code workspace into a formatted text file with selective content inclusion.

## Features

- **Convert any open workspace** to a formatted text file
- **Two selection modes**:
  - GUI Selection: Visual file/folder picker with multi-select
  - Text Input: Comma-separated list (e.g., "README.md, src/")
- **Smart content handling**:
  - Selected files/folders: Full content included
  - Non-selected files: Preview only (first 5 lines)
- **Always includes** complete directory structure
- **Instant clipboard** copy of the output

## Usage

1. Open any folder in VS Code
2. Run the command: `Project To Text: Convert Project`
   - Command Palette: `Ctrl+Shift+P` / `Cmd+Shift+P`
   - Search for "Project To Text"
3. Choose selection mode:
   - **GUI Selection**: Use checkboxes to select files/folders
   - **Text Input**: Enter comma-separated paths
4. Output is automatically copied to clipboard

## Output Format

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

## Installation

1. Install from VS Code Marketplace (coming soon)
2. Or install from VSIX file:
   ```bash
   code --install-extension project-to-text-0.0.1.vsix
   ```

## Requirements

- VS Code 1.100.0 or higher

## Known Issues

- Large files may take a moment to process
- Binary files are skipped

## Release Notes

### 0.0.1

Initial release:
- Basic text conversion functionality
- GUI and text input selection modes
- Directory tree visualization
- File content preview/full inclusion
- Clipboard integration

---

**Enjoy converting your projects to text!**