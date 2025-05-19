import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { GitignoreParser, DEFAULT_EXCLUSIONS, shouldExclude } from './gitignore';

const TRUNCATION_MESSAGE = '[FILE TRUNCATED - showing {shown} of {total} lines]';

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
            // Debug: Log the selection
            console.log('\n=== PROJECT TO TEXT - DEBUG INFO ===');
            console.log('Workspace folder:', workspaceFolder.uri.fsPath);
            console.log('Selection method:', selection ? 'Success' : 'Failed');
            console.log('Selected files:', selection.files);
            console.log('Selected folders:', selection.folders);
            console.log('Full selection object:', JSON.stringify(selection, null, 2));
            console.log('=====================================\n');
            
            // Generate the output
            const output = await generateProjectText(workspaceFolder.uri.fsPath, selection);
            
            // Save to temp file and try to copy to clipboard
            console.log('Output length:', output.length);
            
            try {
                // First attempt to copy to clipboard (for convenience, when it works)
                await vscode.env.clipboard.writeText(output);
                console.log('Clipboard write operation completed');
                
                // Verify if clipboard content was truncated
                const clipboardText = await vscode.env.clipboard.readText();
                const clipboardComplete = clipboardText.length === output.length;
                console.log('Clipboard content length:', clipboardText.length, 'Complete:', clipboardComplete);
                
                // Always save to temp file (regardless of clipboard success)
                // Generate a unique filename in the OS temp directory
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const projectName = path.basename(workspaceFolder.uri.fsPath);
                const tempFilename = `project-to-text_${projectName}_${timestamp}.txt`;
                
                // Use system temp directory (or user's temp directory)
                const tempDir = require('os').tmpdir();
                const tempFilePath = path.join(tempDir, tempFilename);
                
                // Write the file
                await fs.promises.writeFile(tempFilePath, output);
                console.log('Output saved to temp file:', tempFilePath);
                
                // Open the file in Windows Notepad
                try {
                    // Try using openExternal first
                    await vscode.env.openExternal(vscode.Uri.file(tempFilePath));
                } catch (error) {
                    // Use child_process as a fallback for Windows
                    if (process.platform === 'win32' || process.platform.includes('win')) {
                        cp.exec('start notepad.exe "' + tempFilePath + '"');
                    } else if (process.platform === 'linux' && process.env.WSL_DISTRO_NAME) {
                        // Handle WSL - use powershell to open notepad
                        cp.exec('powershell.exe -Command "start notepad \\"' + tempFilePath.replace(/\//g, '\\\\') + '\\""');
                    }
                }
                
                // Inform the user
                if (clipboardComplete) {
                    vscode.window.showInformationMessage('Project text copied to clipboard and opened in Notepad');
                } else {
                    vscode.window.showInformationMessage('Output too large for clipboard - opened in Notepad for copying');
                }
            } catch (error) {
                console.error('Error handling output:', error);
                vscode.window.showErrorMessage(`Error: ${error}`);
            }
        } catch (error) {
            console.error('Error generating project text:', error);
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
            const stats = await fs.promises.stat(fullPath);
            if (stats.isDirectory()) {
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
                    const stats = await fs.promises.stat(fullPath);
                    if (stats.isDirectory()) {
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
            const stats = await fs.promises.stat(itemPath);
            
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

async function generateProjectText(rootPath: string, selection: FileSelection): Promise<string> {
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
    await processDirectory(rootPath, rootPath, selection, output, gitignore, config, fileCount);
    
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

async function processDirectory(dirPath: string, rootPath: string, selection: FileSelection, output: string[], gitignore?: GitignoreParser, config?: ExtensionConfig, fileCount?: { total: number, included: number }): Promise<void> {
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
        
        const stats = await fs.promises.stat(itemPath);
        const relativePath = path.relative(rootPath, itemPath);
        
        if (stats.isDirectory()) {
            console.log(`  Found directory: ${item} (full path: ${relativePath})`);
            console.log(`  About to enter directory: ${itemPath}`);
            await processDirectory(itemPath, rootPath, selection, output, gitignore, config, fileCount);
            console.log(`  Finished processing directory: ${relativePath}`);
        } else {
            if (fileCount) fileCount.total++;
            const shouldIncludeFully = shouldIncludeFileFully(relativePath, selection);
            if (shouldIncludeFully) {
                if (fileCount) fileCount.included++;
                console.log(`  File: ${relativePath} - include fully: true`);
                await processFile(itemPath, relativePath, true, output, config);
            } else {
                console.log(`  File: ${relativePath} - skipping (not selected)`);
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

async function processFile(filePath: string, relativePath: string, includeFully: boolean, output: string[], config?: ExtensionConfig): Promise<void> {
    const displayPath = relativePath.replace(/\\/g, '/');
    console.log(`processFile called - path: ${displayPath}`);
    output.push('================================================');
    output.push(`FILE: ${displayPath}`);
    output.push('================================================');
    
    try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        console.log(`  Adding content for ${displayPath} (${content.length} chars)`);
        
        // Push the content line by line instead of as a whole blob
        // This ensures proper handling of newlines and prevents content merging issues
        const contentLines = content.split('\n');
        for (const line of contentLines) {
            output.push(line);
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