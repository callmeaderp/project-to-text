import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const PREVIEW_LINES = 5;
const TRUNCATION_MESSAGE = '[FILE TRUNCATED - showing {shown} of {total} lines]';

interface FileSelection {
    files: string[];
    folders: string[];
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