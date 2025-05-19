import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GitignoreParser, DEFAULT_EXCLUSIONS, shouldExclude } from './gitignore';

const TRUNCATION_MESSAGE = '[FILE TRUNCATED - showing {shown} of {total} lines]';

// ... same interface definitions ...
interface ExtensionConfig {
    maxTreeDepth: number;
    customExclusions: string[];
    previewLines: number;
}

function getConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('projectToText');
    return {
        maxTreeDepth: config.get<number>('maxTreeDepth', 10),
        customExclusions: config.get<string[]>('customExclusions', []),
        previewLines: config.get<number>('previewLines', 5)
    };
}

interface FileSelection {
    files: string[];
    folders: string[];
}

// ... same extension code through processDirectory ...

async function processDirectory(dirPath: string, rootPath: string, selection: FileSelection, output: string[], gitignore?: GitignoreParser, config?: ExtensionConfig): Promise<void> {
    console.log(`\n=== Processing directory: ${dirPath} ===`);
    console.log(`Root path: ${rootPath}`);
    console.log(`Selected folders: ${selection.folders.join(', ')}`);
    
    const items = await fs.promises.readdir(dirPath);
    console.log(`Items in directory: ${items.join(', ')}`);
    
    // Get all exclusions including custom ones
    const allExclusions = [...DEFAULT_EXCLUSIONS, ...(config?.customExclusions || [])];
    
    for (const item of items) {
        const itemPath = path.join(dirPath, item);
        
        // Check if item should be excluded
        if (shouldExclude(itemPath, allExclusions) || (gitignore && gitignore.isIgnored(itemPath))) {
            console.log(`Excluded: ${itemPath}`);
            continue;
        }
        
        const stats = await fs.promises.stat(itemPath);
        const relativePath = path.relative(rootPath, itemPath);
        console.log(`Processing item: ${relativePath} (${stats.isDirectory() ? 'directory' : 'file'})`);
        
        if (stats.isDirectory()) {
            await processDirectory(itemPath, rootPath, selection, output, gitignore, config);
        } else {
            const shouldIncludeFully = shouldIncludeFileFully(relativePath, selection);
            console.log(`Should include ${relativePath} fully? ${shouldIncludeFully}`);
            await processFile(itemPath, relativePath, shouldIncludeFully, output, config);
        }
    }
}

function shouldIncludeFileFully(relativePath: string, selection: FileSelection): boolean {
    console.log(`\n--- Checking file: ${relativePath} ---`);
    
    // If no selection specified, include everything fully
    if (selection.files.length === 0 && selection.folders.length === 0) {
        console.log('No selection specified, including fully');
        return true;
    }
    
    // Normalize path separators for comparison
    const normalizedPath = relativePath.replace(/\\/g, '/');
    console.log(`Normalized path: ${normalizedPath}`);
    
    // Check if file is explicitly selected
    if (selection.files.includes(relativePath) || selection.files.includes(normalizedPath)) {
        console.log('File explicitly selected');
        return true;
    }
    
    // Check if file is in a selected folder
    console.log(`Checking against ${selection.folders.length} selected folders:`);
    for (const folder of selection.folders) {
        const normalizedFolder = folder.replace(/\\/g, '/');
        const checkPath = normalizedFolder + '/';
        const matches = normalizedPath.startsWith(checkPath);
        console.log(`  Folder: "${normalizedFolder}" - Checking if "${normalizedPath}" starts with "${checkPath}" = ${matches}`);
        
        if (matches) {
            console.log('File is in selected folder!');
            return true;
        }
    }
    
    console.log('File not included');
    return false;
}

// ... rest of the code unchanged ...

export function activate(context: vscode.ExtensionContext) {
    console.log('Project To Text extension (DEBUG) is now active!');

    const disposable = vscode.commands.registerCommand('project-to-text.convertToTextDebug', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder is open');
            return;
        }

        // For debug, use hardcoded selection
        const selection: FileSelection = {
            files: [],
            folders: ['lib']
        };
        
        console.log('\n=== Starting project text generation ===');
        console.log(`Workspace: ${workspaceFolder.uri.fsPath}`);
        console.log(`Selection: ${JSON.stringify(selection)}`);

        try {
            // Generate the output
            const output = await generateProjectText(workspaceFolder.uri.fsPath, selection);
            
            // Copy to clipboard
            await vscode.env.clipboard.writeText(output);
            
            vscode.window.showInformationMessage('Project text copied to clipboard! Check debug console for details.');
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error}`);
            console.error(error);
        }
    });

    context.subscriptions.push(disposable);
}

// Copy other necessary functions from extension.ts
async function processFile(filePath: string, relativePath: string, includeFully: boolean, output: string[], config?: ExtensionConfig): Promise<void> {
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
            const previewLines = config ? config.previewLines : 5;
            const preview = lines.slice(0, previewLines);
            output.push(preview.join('\n'));
            
            if (lines.length > previewLines) {
                output.push('...');
                output.push(TRUNCATION_MESSAGE.replace('{shown}', previewLines.toString()).replace('{total}', lines.length.toString()));
            }
        }
    } catch (error) {
        output.push(`[Error reading file: ${error}]`);
    }
    
    output.push('');
    output.push('');
}

async function generateProjectText(rootPath: string, selection: FileSelection): Promise<string> {
    const output: string[] = [];
    
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
    await processDirectory(rootPath, rootPath, selection, output, gitignore, config);

    return output.join('\n');
}

// Copy buildDirectoryTree from extension.ts
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
        const stats = await fs.promises.stat(itemPath);
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

export function deactivate() {}