# Change Log

All notable changes to the "Project To Text" extension will be documented in this file.

## [Unreleased]

## [0.0.1] - 2025-05-19
### Added
- Initial release
- Convert project to text file functionality
- File/folder selection dialog
- Directory tree builder
- File content processor (full vs preview)
- Format output and copy to clipboard
- GUI selection mode with multi-select QuickPick
- Configuration options for preview line count, tree depth, and exclusions
- Support for .gitignore and default exclusions

### Changed
- Output only shows selected files in the content section
- Removed "(fully included)" text from file names
- Non-selected files are completely omitted from output
- Clipboard output is saved to a file and opened in Windows Notepad for large outputs