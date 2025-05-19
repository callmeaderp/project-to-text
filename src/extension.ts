import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const PREVIEW_LINES = 5;
const TRUNCATION_MESSAGE = '[FILE TRUNCATED - showing {shown} of {total} lines]';

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

    const disposable = vscode.commands.registerCommand('project-to-text.convertToText', async () => {
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
            // Generate the output
            const output = await generateProjectText(workspaceFolder.uri.fsPath, selection);
            
            // Copy to clipboard
            await vscode.env.clipboard.writeText(output);
            
            vscode.window.showInformationMessage('Project text copied to clipboard!');
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
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

    const items = input.split(',').map(item => item.trim());
    const files: string[] = [];
    const folders: string[] = [];

    for (const item of items) {
        if (item.endsWith('/')) {
            folders.push(item.slice(0, -1));
        } else {
            files.push(item);
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

    // Get all files and folders in the workspace
    const items = await getAllFilesAndFolders(workspaceFolder.uri.fsPath);
    
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

    return { files, folders };
}

interface FileInfo {
    relativePath: string;
    isDirectory: boolean;
}

async function getAllFilesAndFolders(rootPath: string, currentPath: string = '', basePath?: string): Promise<FileInfo[]> {
    const results: FileInfo[] = [];
    const base = basePath || rootPath;
    const fullPath = path.join(rootPath, currentPath);
    
    try {
        const items = await fs.promises.readdir(fullPath);
        
        for (const item of items) {
            // Skip common directories
            if (item === 'node_modules' || item === '.git' || item === 'out' || item === '.vscode-test') {
                continue;
            }
            
            const itemPath = path.join(fullPath, item);
            const itemRelativePath = path.join(currentPath, item);
            const stats = await fs.promises.stat(itemPath);
            
            // Normalize path separators
            const normalizedPath = itemRelativePath.replace(/\\/g, '/');
            
            results.push({
                relativePath: normalizedPath,
                isDirectory: stats.isDirectory()
            });
            
            // Recursively get files from subdirectories
            if (stats.isDirectory()) {
                const subItems = await getAllFilesAndFolders(rootPath, itemRelativePath, base);
                results.push(...subItems);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${fullPath}:`, error);
    }
    
    return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function generateProjectText(rootPath: string, selection: FileSelection): Promise<string> {
    const output: string[] = [];
    
    // Generate directory structure
    output.push('Directory structure:');
    const tree = await buildDirectoryTree(rootPath);
    output.push(tree);
    output.push('');
    output.push('');
    output.push('Files Content:');
    output.push('');

    // Process all files
    await processDirectory(rootPath, rootPath, selection, output);

    return output.join('\n');
}

async function buildDirectoryTree(dirPath: string, prefix: string = '', isLast: boolean = true, basePath?: string): Promise<string> {
    const output: string[] = [];
    const base = basePath || dirPath;
    const relativePath = path.relative(base, dirPath);
    const dirName = relativePath === '' ? path.basename(dirPath) : path.basename(relativePath);
    
    // Add current directory
    output.push(prefix + (isLast ? '└── ' : '├── ') + dirName + '/');
    
    // Read directory contents
    const items = await fs.promises.readdir(dirPath);
    const sortedItems = items.sort();
    
    for (let i = 0; i < sortedItems.length; i++) {
        const item = sortedItems[i];
        const itemPath = path.join(dirPath, item);
        const stats = await fs.promises.stat(itemPath);
        const isLastItem = i === sortedItems.length - 1;
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        
        if (stats.isDirectory()) {
            // Skip node_modules and other common directories
            if (item === 'node_modules' || item === '.git' || item === 'out') {
                continue;
            }
            const subTree = await buildDirectoryTree(itemPath, newPrefix, isLastItem, base);
            output.push(subTree);
        } else {
            output.push(newPrefix + (isLastItem ? '└── ' : '├── ') + item);
        }
    }
    
    return output.join('\n');
}

async function processDirectory(dirPath: string, rootPath: string, selection: FileSelection, output: string[]): Promise<void> {
    const items = await fs.promises.readdir(dirPath);
    
    for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.promises.stat(itemPath);
        const relativePath = path.relative(rootPath, itemPath);
        
        if (stats.isDirectory()) {
            // Skip common directories
            if (item === 'node_modules' || item === '.git' || item === 'out') {
                continue;
            }
            await processDirectory(itemPath, rootPath, selection, output);
        } else {
            const shouldIncludeFully = shouldIncludeFileFully(relativePath, selection);
            await processFile(itemPath, relativePath, shouldIncludeFully, output);
        }
    }
}

function shouldIncludeFileFully(relativePath: string, selection: FileSelection): boolean {
    // If no selection specified, include everything fully
    if (selection.files.length === 0 && selection.folders.length === 0) {
        return true;
    }
    
    // Normalize path separators for comparison
    const normalizedPath = relativePath.replace(/\\/g, '/');
    
    // Check if file is explicitly selected
    if (selection.files.includes(relativePath) || selection.files.includes(normalizedPath)) {
        return true;
    }
    
    // Check if file is in a selected folder
    for (const folder of selection.folders) {
        const normalizedFolder = folder.replace(/\\/g, '/');
        if (normalizedPath.startsWith(normalizedFolder + '/')) {
            return true;
        }
    }
    
    return false;
}

async function processFile(filePath: string, relativePath: string, includeFully: boolean, output: string[]): Promise<void> {
    const displayPath = relativePath.replace(/\\/g, '/');
    output.push('================================================');
    output.push(`FILE: ${displayPath}${includeFully ? '' : ' (preview only)'}`);
    output.push('================================================');
    
    try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        
        if (includeFully) {
            output.push(content);
        } else {
            // Show only preview
            const previewLines = lines.slice(0, PREVIEW_LINES);
            output.push(previewLines.join('\n'));
            
            if (lines.length > PREVIEW_LINES) {
                output.push('...');
                output.push(TRUNCATION_MESSAGE.replace('{shown}', PREVIEW_LINES.toString()).replace('{total}', lines.length.toString()));
            }
        }
    } catch (error) {
        output.push(`[Error reading file: ${error}]`);
    }
    
    output.push('');
    output.push('');
}

export function deactivate() {}