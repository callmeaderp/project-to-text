// Test file to debug selection issues
import * as path from 'path';

// Test the selection logic
const selection = {
    files: [],
    folders: ['lib']
};

// Test files from the Flutter project
const testFiles = [
    'lib/main.dart',
    'lib/calculation/calculation_engine.dart',
    'lib/data/database/DatabaseHelper.dart',
    'android/app/build.gradle.kts',
    '.gitignore'
];

function shouldIncludeFileFully(relativePath: string, selection: { files: string[], folders: string[] }): boolean {
    // If no selection specified, include everything fully
    if (selection.files.length === 0 && selection.folders.length === 0) {
        return true;
    }
    
    // Normalize path separators for comparison
    const normalizedPath = relativePath.replace(/\\/g, '/');
    console.log(`Checking file: "${normalizedPath}"`);
    console.log(`Selected folders: ${selection.folders.join(', ')}`);
    
    // Check if file is explicitly selected
    if (selection.files.includes(relativePath) || selection.files.includes(normalizedPath)) {
        return true;
    }
    
    // Check if file is in a selected folder
    for (const folder of selection.folders) {
        const normalizedFolder = folder.replace(/\\/g, '/');
        console.log(`Comparing: "${normalizedPath}" with folder: "${normalizedFolder}"`);
        
        // Check if the file path is within the selected folder
        if (normalizedPath.startsWith(normalizedFolder + '/') || normalizedPath === normalizedFolder) {
            console.log(`MATCH! File is within selected folder`);
            return true;
        }
    }
    
    return false;
}

// Test each file
console.log('Testing file selection logic:');
console.log('Selected folders:', selection.folders);
console.log('');

for (const file of testFiles) {
    const result = shouldIncludeFileFully(file, selection);
    console.log(`File: ${file} => ${result ? 'INCLUDE FULLY' : 'PREVIEW ONLY'}`);
    console.log('---');
}