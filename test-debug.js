// Simulate the path comparison logic for debugging

// Test case: Flutter project with lib folder selected
const testCases = [
    {
        relativePath: 'lib/main.dart',
        selection: { files: [], folders: ['lib'] },
        description: 'lib/main.dart with lib folder selected'
    },
    {
        relativePath: 'lib\\main.dart',
        selection: { files: [], folders: ['lib'] },
        description: 'lib\\main.dart (Windows path) with lib folder selected'
    },
    {
        relativePath: 'lib/calculation/calculation_engine.dart',
        selection: { files: [], folders: ['lib'] },
        description: 'lib/calculation/calculation_engine.dart with lib folder selected'
    },
    {
        relativePath: 'lib/main.dart',
        selection: { files: [], folders: ['/lib'] },
        description: 'lib/main.dart with /lib folder selected (with leading slash)'
    },
    {
        relativePath: 'lib/main.dart',
        selection: { files: ['/lib'], folders: [] },
        description: 'lib/main.dart with /lib as file selected'
    }
];

function shouldIncludeFileFully(relativePath, selection) {
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

// Run all test cases
console.log('=== Testing Path Comparison Logic ===\n');

testCases.forEach((test, index) => {
    console.log(`Test ${index + 1}: ${test.description}`);
    const result = shouldIncludeFileFully(test.relativePath, test.selection);
    console.log(`Final result: ${result ? 'INCLUDED' : 'EXCLUDED'}`);
    console.log('---\n');
});