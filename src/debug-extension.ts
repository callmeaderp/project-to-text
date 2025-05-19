import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GitignoreParser, DEFAULT_EXCLUSIONS, shouldExclude } from './gitignore';

// Debug version of shouldIncludeFileFully to log paths
export function shouldIncludeFileFullyDebug(relativePath: string, selection: any): boolean {
    console.log(`Checking file: ${relativePath}`);
    
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
    for (const folder of selection.folders) {
        const normalizedFolder = folder.replace(/\\/g, '/');
        console.log(`Checking against folder: ${normalizedFolder}`);
        console.log(`Starts with ${normalizedFolder}/? ${normalizedPath.startsWith(normalizedFolder + '/')}`);
        
        if (normalizedPath.startsWith(normalizedFolder + '/')) {
            console.log('File is in selected folder');
            return true;
        }
    }
    
    console.log('File not included');
    return false;
}

// Debug version of processDirectory to track what's happening
export async function processDirectoryDebug(dirPath: string, rootPath: string, selection: any, output: string[], gitignore?: GitignoreParser, config?: any): Promise<void> {
    console.log(`Processing directory: ${dirPath}`);
    const items = await fs.promises.readdir(dirPath);
    console.log(`Found items: ${items.join(', ')}`);
    
    // Get all exclusions including custom ones
    const allExclusions = [...DEFAULT_EXCLUSIONS, ...(config?.customExclusions || [])];
    
    for (const item of items) {
        const itemPath = path.join(dirPath, item);
        console.log(`Checking item: ${itemPath}`);
        
        // Check if item should be excluded
        if (shouldExclude(itemPath, allExclusions)) {
            console.log(`Item excluded by pattern: ${item}`);
            continue;
        }
        
        if (gitignore && gitignore.isIgnored(itemPath)) {
            console.log(`Item ignored by gitignore: ${item}`);
            continue;
        }
        
        const stats = await fs.promises.stat(itemPath);
        const relativePath = path.relative(rootPath, itemPath);
        console.log(`Relative path: ${relativePath}`);
        
        if (stats.isDirectory()) {
            console.log(`Recursing into directory: ${itemPath}`);
            await processDirectoryDebug(itemPath, rootPath, selection, output, gitignore, config);
        } else {
            const shouldIncludeFully = shouldIncludeFileFullyDebug(relativePath, selection);
            console.log(`Should include ${relativePath} fully? ${shouldIncludeFully}`);
            // Would call processFile here
        }
    }
}