import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { GitignoreParser, DEFAULT_EXCLUSIONS, shouldExclude } from './gitignore';

const TRUNCATION_MESSAGE = '[FILE TRUNCATED - showing {shown} of {total} lines]';
const TEMP_FILE_PREFIX = 'project-to-text-output-';

// Common binary file extensions and text file extensions
const BINARY_EXTENSIONS = new Set([
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg', '.webp', '.tiff', '.tif',
    // Videos
    '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.m4v', '.mpg', '.mpeg',
    // Audio
    '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a', '.opus',
    // Archives
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.z', '.lz', '.lzma', '.deb', '.rpm',
    // Executables and libraries
    '.exe', '.dll', '.so', '.dylib', '.app', '.deb', '.rpm', '.dmg', '.pkg', '.msi',
    // Fonts
    '.ttf', '.otf', '.woff', '.woff2', '.eot',
    // Documents (binary formats)
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
    // Database
    '.db', '.sqlite', '.sqlite3', '.mdb',
    // Other binary formats
    '.pyc', '.pyo', '.class', '.jar', '.war', '.ear', '.o', '.obj', '.pdb', '.lib', '.a',
    '.bin', '.dat', '.data', '.dump', '.img', '.iso', '.toast', '.vcd', '.crx', '.xpi',
    '.dex', '.apk', '.ipa', '.cab', '.msp', '.msu', '.wasm'
]);

/**
 * Check if a file is likely binary based on its extension
 */
function isBinaryFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return BINARY_EXTENSIONS.has(ext);
}

/**
 * Delete old temp files created by this extension
 */
function cleanupOldTempFiles(): void {
    try {
        const tempDir = require('os').tmpdir();
        const files = fs.readdirSync(tempDir);
        
        for (const file of files) {
            if (file.startsWith(TEMP_FILE_PREFIX) && file.endsWith('.txt')) {
                try {
                    fs.unlinkSync(path.join(tempDir, file));
                    console.log(`Cleaned up old temp file: ${file}`);
                } catch (error) {
                    // Ignore errors for files that can't be deleted (e.g., still open)
                    console.log(`Could not delete temp file ${file}:`, error);
                }
            }
        }
    } catch (error) {
        console.error('Error cleaning up temp files:', error);
    }
}

interface ExtensionConfig {
    maxTreeDepth: number;
    customExclusions: string[];
    previewLines: number;
    conciseMode: boolean;
    directoriesOnly: boolean;
}

function getConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('projectToText');
    return {
        maxTreeDepth: config.get<number>('maxTreeDepth', 10),
        customExclusions: config.get<string[]>('customExclusions', []),
        previewLines: config.get<number>('previewLines', 5),
        conciseMode: config.get<boolean>('conciseMode', false),
        directoriesOnly: config.get<boolean>('directoriesOnly', false)
    };
}

function extractConciseContent(content: string, fileExtension: string): string {
    const lines = content.split('\n');
    const conciseLines: string[] = [];
    
    // Language-specific patterns
    const isCodeFile = /\.(js|ts|jsx|tsx|java|cs|cpp|c|h|py|rb|go|rs|php|swift|kt|scala|dart)$/i.test(fileExtension);
    const isJavaScriptLike = /\.(js|ts|jsx|tsx)$/i.test(fileExtension);
    const isPython = /\.py$/i.test(fileExtension);
    const isCFamily = /\.(c|cpp|cs|h|java)$/i.test(fileExtension);
    
    // Pattern matchers
    const importPattern = /^(import\s|from\s|require\s*\(|using\s|include\s|#include)/;
    const exportPattern = /^export\s/;
    const functionPattern = /^(export\s+)?(async\s+)?(function\s+\w+|const\s+\w+\s*=\s*(async\s*)?\(|let\s+\w+\s*=\s*(async\s*)?\(|var\s+\w+\s*=\s*(async\s*)?\()/;
    const classPattern = /^(export\s+)?(abstract\s+)?(class|interface|enum|type|struct)\s+\w+/;
    const methodPattern = /^\s*(public|private|protected|static|async|override|virtual)?\s*\w+\s*\([^)]*\)\s*[:{]/;
    const pyFunctionPattern = /^(async\s+)?def\s+\w+/;
    const pyClassPattern = /^class\s+\w+/;
    const decoratorPattern = /^@\w+/;
    const commentPattern = /^\s*(\/\/|\/\*|#|""")/;
    const docCommentPattern = /^\s*(\/\*\*|\/\/\/)/;
    
    let inMultilineComment = false;
    let inDocstring = false;
    let currentFunctionDepth = 0;
    let skipUntilClosingBrace = false;
    let bracketCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Handle multiline comments
        if (inMultilineComment) {
            conciseLines.push(line);
            if (line.includes('*/')) {
                inMultilineComment = false;
            }
            continue;
        }
        
        // Handle Python docstrings
        if (isPython && (line.includes('"""') || line.includes("'''"))) {
            if (!inDocstring) {
                inDocstring = true;
                conciseLines.push(line);
            } else {
                conciseLines.push(line);
                inDocstring = false;
            }
            continue;
        }
        
        if (inDocstring) {
            conciseLines.push(line);
            continue;
        }
        
        // Check for multiline comment start
        if (line.includes('/*') && !line.includes('*/')) {
            inMultilineComment = true;
            conciseLines.push(line);
            continue;
        }
        
        // Skip function/method bodies
        if (skipUntilClosingBrace) {
            bracketCount += (line.match(/\{/g) || []).length;
            bracketCount -= (line.match(/\}/g) || []).length;
            
            if (bracketCount === 0) {
                skipUntilClosingBrace = false;
                // Include the closing brace line
                if (trimmedLine === '}' || trimmedLine === '};') {
                    conciseLines.push(line);
                }
            }
            continue;
        }
        
        // Include imports and requires
        if (importPattern.test(trimmedLine) || exportPattern.test(trimmedLine)) {
            conciseLines.push(line);
            continue;
        }
        
        // Include decorators (Python, TypeScript, etc.)
        if (decoratorPattern.test(trimmedLine)) {
            conciseLines.push(line);
            continue;
        }
        
        // Include comments, especially documentation comments
        if (commentPattern.test(trimmedLine)) {
            conciseLines.push(line);
            // Include subsequent comment lines
            let j = i + 1;
            while (j < lines.length && lines[j].trim().startsWith('*')) {
                conciseLines.push(lines[j]);
                j++;
            }
            i = j - 1;
            continue;
        }
        
        // Include class, interface, enum, type declarations
        if (classPattern.test(trimmedLine) || (isPython && pyClassPattern.test(trimmedLine))) {
            conciseLines.push(line);
            // For single-line type definitions
            if (trimmedLine.includes(';') || (isJavaScriptLike && trimmedLine.includes('='))) {
                continue;
            }
            // Skip class body by counting braces
            if (line.includes('{')) {
                bracketCount = 1;
                skipUntilClosingBrace = true;
            }
            continue;
        }
        
        // Include function declarations (without body)
        if (functionPattern.test(trimmedLine) || (isPython && pyFunctionPattern.test(trimmedLine))) {
            conciseLines.push(line);
            
            // For Python, add the docstring if present
            if (isPython && i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                if (nextLine.trim().startsWith('"""') || nextLine.trim().startsWith("'''")) {
                    conciseLines.push(nextLine);
                    // Find the end of docstring
                    let j = i + 2;
                    while (j < lines.length && !lines[j].includes('"""') && !lines[j].includes("'''")) {
                        conciseLines.push(lines[j]);
                        j++;
                    }
                    if (j < lines.length) {
                        conciseLines.push(lines[j]);
                    }
                }
            }
            
            // Skip function body
            if (line.includes('{')) {
                bracketCount = 1;
                skipUntilClosingBrace = true;
            } else if (isPython) {
                // For Python, skip until the next non-indented line
                const baseIndent = line.search(/\S/);
                let j = i + 1;
                while (j < lines.length) {
                    const nextLine = lines[j];
                    const nextIndent = nextLine.search(/\S/);
                    if (nextIndent !== -1 && nextIndent <= baseIndent) {
                        break;
                    }
                    j++;
                }
                i = j - 1;
            }
            continue;
        }
        
        // Include method signatures in classes
        if (methodPattern.test(trimmedLine) && !trimmedLine.includes('console.') && !trimmedLine.includes('print(')) {
            conciseLines.push(line);
            if (line.includes('{')) {
                bracketCount = 1;
                skipUntilClosingBrace = true;
            }
            continue;
        }
        
        // Include variable declarations (without complex initialization)
        if (isJavaScriptLike) {
            const varDeclPattern = /^(export\s+)?(const|let|var)\s+\w+\s*(:|=)/;
            if (varDeclPattern.test(trimmedLine)) {
                // Include simple declarations
                if (trimmedLine.includes(':') && !trimmedLine.includes('=')) {
                    conciseLines.push(line);
                } else if (trimmedLine.includes('=')) {
                    // Include only if it's a simple value
                    const afterEquals = trimmedLine.split('=')[1].trim();
                    if (afterEquals.match(/^(['"`].*['"`]|true|false|null|undefined|\d+)/) || 
                        afterEquals.startsWith('new ') ||
                        afterEquals.match(/^\{[\s\S]*\}$/)) {
                        conciseLines.push(line.split('=')[0] + ' = ...');
                    }
                }
                continue;
            }
        }
        
        // Include module.exports
        if (trimmedLine.startsWith('module.exports') || trimmedLine.startsWith('exports.')) {
            conciseLines.push(line.split('=')[0] + ' = ...');
            continue;
        }
    }
    
    return conciseLines.join('\n');
}

interface FileSelection {
    files: string[];
    folders: string[];
}

interface FileQuickPickItem extends vscode.QuickPickItem {
    itemPath: string;
    isDirectory: boolean;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Project To Text extension is now active!');

    // Common handler for both commands
    const handleConvertCommand = async (forceConciseMode: boolean = false) => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder is open');
            return;
        }

        // Get user selection
        const selection = await getUserSelection();
        
        if (!selection) {
            return; // User cancelled
        }

        try {
            // Clean up old temp files first
            cleanupOldTempFiles();
            
            // Debug: Log the selection
            console.log('\n=== PROJECT TO TEXT - DEBUG INFO ===');
            console.log('Workspace folder:', workspaceFolder.uri.fsPath);
            console.log('Selection method:', selection ? 'Success' : 'Failed');
            console.log('Selected files:', selection.files);
            console.log('Selected folders:', selection.folders);
            console.log('Full selection object:', JSON.stringify(selection, null, 2));
            console.log('=====================================\n');
            
            // Generate the output
            const output = await generateProjectText(workspaceFolder.uri.fsPath, selection, forceConciseMode);
            
            console.log('Output length:', output.length);
            
            try {
                // Generate a unique filename in the OS temp directory
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const projectName = path.basename(workspaceFolder.uri.fsPath);
                const tempFilename = `${TEMP_FILE_PREFIX}${projectName}_${timestamp}.txt`;
                
                // Use system temp directory
                const tempDir = require('os').tmpdir();
                const tempFilePath = path.join(tempDir, tempFilename);
                
                // Write the file
                await fs.promises.writeFile(tempFilePath, output);
                console.log('Output saved to temp file:', tempFilePath);
                
                // Open the file in VS Code editor
                const document = await vscode.workspace.openTextDocument(tempFilePath);
                await vscode.window.showTextDocument(document);
                
                // Inform the user
                vscode.window.showInformationMessage('Project text generated and opened in editor');
            } catch (error) {
                console.error('Error handling output:', error);
                vscode.window.showErrorMessage(`Error: ${error}`);
            }
        } catch (error) {
            console.error('Error generating project text:', error);
            vscode.window.showErrorMessage(`Error: ${error}`);
        }
    };

    // Register normal command
    const disposable = vscode.commands.registerCommand('project-to-text.convertToText', () => handleConvertCommand(false));
    context.subscriptions.push(disposable);

    // Register concise mode command
    const disposableConcise = vscode.commands.registerCommand('project-to-text.convertToTextConcise', () => handleConvertCommand(true));
    context.subscriptions.push(disposableConcise);
}

async function getUserSelection(): Promise<FileSelection | null> {
    // Ask user to choose input method
    const inputMethod = await vscode.window.showQuickPick(
        ['GUI Selection', 'Text Input'],
        {
            placeHolder: 'Choose how to select files/folders'
        }
    );

    if (!inputMethod) {
        return null; // User cancelled
    }

    if (inputMethod === 'GUI Selection') {
        return await getGUISelection();
    } else {
        return await getTextSelection();
    }
}

async function getTextSelection(): Promise<FileSelection | null> {
    const input = await vscode.window.showInputBox({
        prompt: 'Enter files/folders to include fully (comma-separated, e.g., "README.md, package.json, src/")',
        placeHolder: 'Leave empty to include all files fully'
    });

    if (input === undefined) {
        return null; // User cancelled
    }

    if (input.trim() === '') {
        return { files: [], folders: [] }; // Include everything fully
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        throw new Error('No workspace folder found');
    }

    const items = input.split(',').map(item => item.trim());
    const files: string[] = [];
    const folders: string[] = [];

    console.log(`getTextSelection: Processing input items: [${items.join(', ')}]`);

    for (const item of items) {
        console.log(`  Processing item: "${item}"`);
        
        // Remove leading slash if present
        let cleanItem = item.startsWith('/') ? item.substring(1) : item;
        // Remove trailing slash for consistency
        cleanItem = cleanItem.endsWith('/') ? cleanItem.slice(0, -1) : cleanItem;
        
        console.log(`    Cleaned item: "${cleanItem}"`);
        
        // Check if the item exists and whether it's a file or directory
        const fullPath = path.join(workspaceFolder.uri.fsPath, cleanItem);
        console.log(`    Full path: "${fullPath}"`);
        
        try {
            // Use lstat to detect symlinks without following them
            const stats = await fs.promises.lstat(fullPath);
            
            if (stats.isSymbolicLink()) {
                console.log(`    Result: Symlink detected - attempting to follow: "${cleanItem}"`);
                try {
                    // Try to follow the symlink
                    const targetStats = await fs.promises.stat(fullPath);
                    if (targetStats.isDirectory()) {
                        console.log(`    Symlink target: Directory - adding to folders: "${cleanItem}"`);
                        folders.push(cleanItem);
                    } else {
                        console.log(`    Symlink target: File - adding to files: "${cleanItem}"`);
                        files.push(cleanItem);
                    }
                } catch (symlinkError) {
                    console.log(`    Symlink broken or inaccessible - treating as file: "${cleanItem}"`);
                    files.push(cleanItem);
                }
            } else if (stats.isDirectory()) {
                console.log(`    Result: Directory - adding to folders: "${cleanItem}"`);
                folders.push(cleanItem);
            } else {
                console.log(`    Result: File - adding to files: "${cleanItem}"`);
                files.push(cleanItem);
            }
        } catch (error) {
            console.log(`    Error checking path: ${error}`);
            // If it doesn't exist yet, guess based on pattern
            if (item.endsWith('/')) {
                console.log(`    Guessing directory (ends with /) - adding to folders: "${cleanItem}"`);
                folders.push(cleanItem);
            } else {
                // For ambiguous cases like "lib", check if it exists as a directory
                console.log(`    Ambiguous case - checking again`);
                try {
                    // Use lstat to detect symlinks without following them
                    const stats = await fs.promises.lstat(fullPath);
                    
                    if (stats.isSymbolicLink()) {
                        console.log(`    Symlink detected in ambiguous case - attempting to follow: "${cleanItem}"`);
                        try {
                            const targetStats = await fs.promises.stat(fullPath);
                            if (targetStats.isDirectory()) {
                                console.log(`    Symlink target: Directory - adding to folders: "${cleanItem}"`);
                                folders.push(cleanItem);
                            } else {
                                console.log(`    Symlink target: File - adding to files: "${cleanItem}"`);
                                files.push(cleanItem);
                            }
                        } catch (symlinkError) {
                            console.log(`    Symlink broken or inaccessible - defaulting to file: "${cleanItem}"`);
                            files.push(cleanItem);
                        }
                    } else if (stats.isDirectory()) {
                        console.log(`    Found as directory - adding to folders: "${cleanItem}"`);
                        folders.push(cleanItem);
                    } else {
                        console.log(`    Found as file - adding to files: "${cleanItem}"`);
                        files.push(cleanItem);
                    }
                } catch {
                    // Default to treating as file if can't determine
                    console.log(`    Cannot determine - defaulting to file: "${cleanItem}"`);
                    files.push(cleanItem);
                }
            }
        }
    }

    return { files, folders };
}

async function getGUISelection(): Promise<FileSelection | null> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder is open');
        return null;
    }

    // Get configuration
    const config = getConfig();
    
    // Get all files and folders in the workspace
    const items = await getAllFilesAndFolders(workspaceFolder.uri.fsPath, '', undefined, undefined, config);
    
    // Create QuickPick items
    const quickPickItems: FileQuickPickItem[] = items.map(item => ({
        label: item.isDirectory ? `📁 ${item.relativePath}/` : `📄 ${item.relativePath}`,
        itemPath: item.relativePath,
        isDirectory: item.isDirectory,
        description: item.isDirectory ? 'Folder' : 'File'
    }));

    // Show multi-select quick pick
    const selected = await vscode.window.showQuickPick(quickPickItems, {
        canPickMany: true,
        placeHolder: 'Select files and folders to include fully (press Space to select, Enter to confirm)'
    });

    if (!selected) {
        return null; // User cancelled
    }

    // If nothing selected, show warning
    if (selected.length === 0) {
        const choice = await vscode.window.showWarningMessage(
            'No files or folders selected. Include all files fully?',
            'Yes', 'No'
        );
        
        if (choice === 'Yes') {
            return { files: [], folders: [] }; // Include everything fully
        } else {
            return null; // User cancelled
        }
    }

    // Separate files and folders
    const files: string[] = [];
    const folders: string[] = [];

    for (const item of selected) {
        if (item.isDirectory) {
            folders.push(item.itemPath);
        } else {
            files.push(item.itemPath);
        }
    }

    console.log('Selected files:', files);
    console.log('Selected folders:', folders);

    return { files, folders };
}

interface FileInfo {
    relativePath: string;
    isDirectory: boolean;
}

async function getAllFilesAndFolders(rootPath: string, currentPath: string = '', basePath?: string, gitignore?: GitignoreParser, config?: ExtensionConfig): Promise<FileInfo[]> {
    const results: FileInfo[] = [];
    const base = basePath || rootPath;
    const fullPath = path.join(rootPath, currentPath);
    
    // Initialize gitignore parser on first call
    if (!gitignore) {
        gitignore = new GitignoreParser(rootPath);
        await gitignore.load();
    }
    
    // Get all exclusions including custom ones
    const allExclusions = [...DEFAULT_EXCLUSIONS, ...(config?.customExclusions || [])];
    
    try {
        const items = await fs.promises.readdir(fullPath);
        
        for (const item of items) {
            const itemPath = path.join(fullPath, item);
            
            // Check if item should be excluded
            if (shouldExclude(itemPath, allExclusions) || gitignore.isIgnored(itemPath)) {
                continue;
            }
            
            const itemRelativePath = path.join(currentPath, item);
            
            // Use lstat to detect symlinks without following them
            let stats;
            try {
                stats = await fs.promises.lstat(itemPath);
                
                // If it's a symlink, try to get the target stats
                if (stats.isSymbolicLink()) {
                    try {
                        stats = await fs.promises.stat(itemPath);
                    } catch (symlinkError) {
                        // If symlink is broken or inaccessible, skip it
                        console.log(`Skipping broken symlink: ${itemPath}`);
                        continue;
                    }
                }
            } catch (error) {
                console.error(`Error accessing ${itemPath}:`, error);
                continue;
            }
            
            // Normalize path separators
            const normalizedPath = itemRelativePath.replace(/\\/g, '/');
            
            results.push({
                relativePath: normalizedPath,
                isDirectory: stats.isDirectory()
            });
            
            // Recursively get files from subdirectories
            if (stats.isDirectory()) {
                const subItems = await getAllFilesAndFolders(rootPath, itemRelativePath, base, gitignore, config);
                results.push(...subItems);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${fullPath}:`, error);
    }
    
    return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function generateProjectText(rootPath: string, selection: FileSelection, forceConciseMode: boolean = false): Promise<string> {
    const output: string[] = [];
    
    console.log('\n=== GENERATE PROJECT TEXT ===');
    console.log('Root path:', rootPath);
    console.log('Selection:', JSON.stringify(selection, null, 2));
    
    // Initialize gitignore parser
    const gitignore = new GitignoreParser(rootPath);
    await gitignore.load();
    
    // Get configuration
    const config = getConfig();
    
    // Generate directory structure
    output.push('Directory structure:');
    const tree = await buildDirectoryTree(rootPath, '', true, undefined, gitignore, config, 0);
    output.push(tree);
    output.push('');
    output.push('');
    output.push('Files Content:');
    output.push('');

    // Process all files
    const fileCount = { total: 0, included: 0 };
    console.log('\nStarting file processing...');
    await processDirectory(rootPath, rootPath, selection, output, gitignore, config, fileCount, forceConciseMode);
    
    console.log(`\nProcessing complete. Total files: ${fileCount.total}, Included fully: ${fileCount.included}`);
    console.log('Output array length:', output.length);
    console.log('Total output size:', output.join('\n').length, 'characters');
    console.log('=============================\n');
    
    const finalOutput = output.join('\n');
    
    // Add library files debugging
    console.log('OUTPUT ARRAY DIAGNOSTICS:');
    console.log('Total output array items:', output.length);
    
    // Check for lib files in the output array
    const libFileHeaders = output.filter(line => line.includes('FILE: lib/') && line.includes('(fully included)'));
    console.log('Number of lib file headers found:', libFileHeaders.length);
    if (libFileHeaders.length > 0) {
        console.log('Sample lib file headers:', libFileHeaders.slice(0, 3));
        
        // Check positions of lib file headers in the array
        libFileHeaders.slice(0, 3).forEach(header => {
            const index = output.indexOf(header);
            console.log(`Header "${header}" found at index ${index}`);
            console.log(`5 items before:`, output.slice(Math.max(0, index - 5), index));
            console.log(`5 items after:`, output.slice(index + 1, index + 6));
        });
    }
    
    // Check if lib files are retained in the final output string
    const libFilesInFinalOutput = finalOutput.includes('FILE: lib/');
    console.log('Lib files found in final output string:', libFilesInFinalOutput);
    
    // Check potential truncation
    console.log('Final output length:', finalOutput.length);
    console.log('Final output preview (first 1000 chars):', finalOutput.substring(0, 1000));
    console.log('Final output preview (last 1000 chars):', finalOutput.substring(Math.max(0, finalOutput.length - 1000)));
    
    return finalOutput;
}

async function buildDirectoryTree(dirPath: string, prefix: string = '', isLast: boolean = true, basePath?: string, gitignore?: GitignoreParser, config?: ExtensionConfig, currentDepth: number = 0): Promise<string> {
    const output: string[] = [];
    const base = basePath || dirPath;
    const relativePath = path.relative(base, dirPath);
    const dirName = relativePath === '' ? path.basename(dirPath) : path.basename(relativePath);
    
    // Add current directory
    output.push(prefix + (isLast ? '└── ' : '├── ') + dirName + '/');
    
    // Check if we've reached max depth
    if (config && config.maxTreeDepth > 0 && currentDepth >= config.maxTreeDepth) {
        output.push(prefix + (isLast ? '    ' : '│   ') + '└── ...');
        return output.join('\n');
    }
    
    // Read directory contents
    const items = await fs.promises.readdir(dirPath);
    const sortedItems = items.sort();
    
    // Get all exclusions including custom ones
    const allExclusions = [...DEFAULT_EXCLUSIONS, ...(config?.customExclusions || [])];
    
    // Filter out excluded items
    const filteredItems: string[] = [];
    for (const item of sortedItems) {
        const itemPath = path.join(dirPath, item);
        
        // Check if item should be excluded
        if (shouldExclude(itemPath, allExclusions) || (gitignore && gitignore.isIgnored(itemPath))) {
            continue;
        }
        
        filteredItems.push(item);
    }
    
    for (let i = 0; i < filteredItems.length; i++) {
        const item = filteredItems[i];
        const itemPath = path.join(dirPath, item);
        
        let stats;
        try {
            // Use lstat to detect symlinks without following them
            stats = await fs.promises.lstat(itemPath);
            
            // If it's a symlink, try to get the target stats
            if (stats.isSymbolicLink()) {
                try {
                    stats = await fs.promises.stat(itemPath);
                } catch (symlinkError) {
                    // If symlink is broken or inaccessible, skip it
                    console.log(`Skipping broken symlink in tree: ${itemPath}`);
                    continue;
                }
            }
        } catch (error) {
            console.error(`Error accessing ${itemPath} in tree:`, error);
            continue;
        }
        
        const isLastItem = i === filteredItems.length - 1;
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        
        if (stats.isDirectory()) {
            const subTree = await buildDirectoryTree(itemPath, newPrefix, isLastItem, base, gitignore, config, currentDepth + 1);
            output.push(subTree);
        } else {
            output.push(newPrefix + (isLastItem ? '└── ' : '├── ') + item);
        }
    }
    
    return output.join('\n');
}

async function processDirectory(dirPath: string, rootPath: string, selection: FileSelection, output: string[], gitignore?: GitignoreParser, config?: ExtensionConfig, fileCount?: { total: number, included: number }, forceConciseMode: boolean = false): Promise<void> {
    const items = await fs.promises.readdir(dirPath);
    const relativeDirPath = path.relative(rootPath, dirPath);
    console.log(`\n>>> PROCESSING DIRECTORY: "${dirPath}"`);
    console.log(`>>> Relative path: "${relativeDirPath || '(root)'}"`);
    console.log(`>>> Contains ${items.length} items: [${items.join(', ')}]`);
    
    // Get all exclusions including custom ones
    const allExclusions = [...DEFAULT_EXCLUSIONS, ...(config?.customExclusions || [])];
    
    for (const item of items) {
        console.log(`\n  Checking item: "${item}"`);
        const itemPath = path.join(dirPath, item);
        console.log(`  Full path: "${itemPath}"`);
        
        // Check if item should be excluded
        const isExcludedByPattern = shouldExclude(itemPath, allExclusions);
        const isIgnoredByGitignore = gitignore ? gitignore.isIgnored(itemPath) : false;
        
        console.log(`  Excluded by pattern: ${isExcludedByPattern}`);
        console.log(`  Ignored by gitignore: ${isIgnoredByGitignore}`);
        
        if (isExcludedByPattern || isIgnoredByGitignore) {
            console.log(`  SKIPPING: ${item} (pattern: ${isExcludedByPattern}, gitignore: ${isIgnoredByGitignore})`);
            continue;
        }
        
        let stats;
        try {
            // Use lstat to detect symlinks without following them
            stats = await fs.promises.lstat(itemPath);
            
            // If it's a symlink, try to get the target stats
            if (stats.isSymbolicLink()) {
                try {
                    stats = await fs.promises.stat(itemPath);
                } catch (symlinkError) {
                    console.log(`Skipping broken symlink: ${itemPath}`);
                    continue;
                }
            }
        } catch (error) {
            console.error(`Error accessing ${itemPath}:`, error);
            continue;
        }
        
        const relativePath = path.relative(rootPath, itemPath);
        
        if (stats.isDirectory()) {
            console.log(`  Found directory: ${item} (full path: ${relativePath})`);
            console.log(`  About to enter directory: ${itemPath}`);
            await processDirectory(itemPath, rootPath, selection, output, gitignore, config, fileCount, forceConciseMode);
            console.log(`  Finished processing directory: ${relativePath}`);
        } else {
            if (fileCount) {fileCount.total++;}
            const shouldIncludeFully = shouldIncludeFileFully(relativePath, selection);
            
            // In directories-only mode, only process files that are explicitly selected
            if (config?.directoriesOnly && !shouldIncludeFully) {
                console.log(`  File: ${relativePath} - skipping (directories-only mode)`);
            } else if (shouldIncludeFully) {
                if (fileCount) {fileCount.included++;}
                console.log(`  File: ${relativePath} - include fully: true`);
                await processFile(itemPath, relativePath, true, output, config, forceConciseMode);
            } else if (!config?.directoriesOnly) {
                // Include preview for non-selected files when not in directories-only mode
                console.log(`  File: ${relativePath} - include preview`);
                await processFile(itemPath, relativePath, false, output, config, forceConciseMode);
            }
        }
    }
}

function shouldIncludeFileFully(relativePath: string, selection: FileSelection): boolean {
    // If no selection specified, include everything fully
    if (selection.files.length === 0 && selection.folders.length === 0) {
        return true;
    }
    
    // Normalize path separators for comparison and remove any leading slashes
    const normalizedPath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    
    console.log(`    shouldIncludeFileFully called:`);
    console.log(`      Original path: "${relativePath}"`);
    console.log(`      Normalized path: "${normalizedPath}"`);
    console.log(`      Selected files: [${selection.files.join(', ')}]`);
    console.log(`      Selected folders: [${selection.folders.join(', ')}]`);
    
    // Check if file is explicitly selected (normalize both sides)
    const normalizedSelectedFiles = selection.files.map(f => f.replace(/\\/g, '/').replace(/^\/+/, ''));
    if (normalizedSelectedFiles.includes(normalizedPath)) {
        console.log(`      Result: TRUE (file explicitly selected)`);
        return true;
    }
    
    // Check if file is in a selected folder
    for (const folder of selection.folders) {
        // Normalize folder path and remove leading slashes
        const normalizedFolder = folder.replace(/\\/g, '/').replace(/^\/+/, '');
        
        console.log(`      Checking against folder: "${folder}" -> normalized: "${normalizedFolder}"`);
        
        // Check if the file path is within the selected folder
        // We need to handle the case where the folder itself matches or the file is within it
        if (normalizedPath === normalizedFolder || 
            normalizedPath.startsWith(normalizedFolder + '/')) {
            console.log(`      Result: TRUE (file is within selected folder "${normalizedFolder}")`);
            return true;
        }
    }
    
    console.log(`      Result: FALSE (file not selected)`);
    return false;
}

async function processFile(filePath: string, relativePath: string, includeFully: boolean, output: string[], config?: ExtensionConfig, forceConciseMode: boolean = false): Promise<void> {
    const displayPath = relativePath.replace(/\\/g, '/');
    console.log(`processFile called - path: ${displayPath}, includeFully: ${includeFully}`);
    
    // Check if this is a binary file
    if (isBinaryFile(filePath)) {
        console.log(`  Skipping binary file: ${displayPath}`);
        // Binary files are included in directory tree but not in content section
        return;
    }
    
    output.push('================================================');
    output.push(`FILE: ${displayPath}${includeFully ? ' (fully included)' : ' (preview only)'}`);
    output.push('================================================');
    
    try {
        // Check if this is a symlink and handle appropriately
        const stats = await fs.promises.lstat(filePath);
        
        let content;
        if (stats.isSymbolicLink()) {
            console.log(`  Processing symlink: ${displayPath}`);
            try {
                // Try to read the symlink target
                content = await fs.promises.readFile(filePath, 'utf-8');
                console.log(`  Successfully read symlink target for ${displayPath} (${content.length} chars)`);
            } catch (symlinkError) {
                console.log(`  Failed to read symlink ${displayPath}:`, symlinkError);
                output.push(`[Symlink could not be read: ${symlinkError}]`);
                return;
            }
        } else {
            content = await fs.promises.readFile(filePath, 'utf-8');
            console.log(`  Adding content for ${displayPath} (${content.length} chars)`);
        }
        
        // Apply concise mode if enabled and file is fully included
        if ((forceConciseMode || config?.conciseMode) && includeFully) {
            const fileExtension = path.extname(filePath);
            content = extractConciseContent(content, fileExtension);
            console.log(`  Applied concise mode - reduced to ${content.length} chars`);
        }
        
        // Handle preview mode (not fully included)
        if (!includeFully) {
            const lines = content.split('\n');
            const previewLineCount = config?.previewLines || 5;
            const totalLines = lines.length;
            
            if (totalLines > previewLineCount) {
                // Show only preview lines
                const previewLines = lines.slice(0, previewLineCount);
                for (const line of previewLines) {
                    output.push(line);
                }
                output.push('...');
                output.push(TRUNCATION_MESSAGE.replace('{shown}', previewLineCount.toString()).replace('{total}', totalLines.toString()));
            } else {
                // File is small enough to show completely
                for (const line of lines) {
                    output.push(line);
                }
            }
        } else {
            // Push the content line by line
            const contentLines = content.split('\n');
            for (const line of contentLines) {
                output.push(line);
            }
        }
        
        // Add a debug marker after processing a file
        console.log(`  ✓ Content added - output array now has ${output.length} items`);
    } catch (error) {
        output.push(`[Error reading file: ${error}]`);
    }
    
    output.push('');
    output.push('');
}

export function deactivate() {}