import * as path from 'path';

// Test the shouldIncludeFileFully logic
function shouldIncludeFileFully(relativePath: string, selection: { files: string[], folders: string[] }): boolean {
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

// Test cases
const testCases = [
    {
        name: "File in lib folder",
        relativePath: "lib/index.js",
        selection: { files: [], folders: ["lib"] },
        expected: true
    },
    {
        name: "File in lib subfolder",
        relativePath: "lib/utils/helper.js",
        selection: { files: [], folders: ["lib"] },
        expected: true
    },
    {
        name: "File not in lib folder",
        relativePath: "src/index.js",
        selection: { files: [], folders: ["lib"] },
        expected: false
    },
    {
        name: "Windows path in lib folder",
        relativePath: "lib\\index.js",
        selection: { files: [], folders: ["lib"] },
        expected: true
    },
    {
        name: "Windows folder selection",
        relativePath: "lib/index.js",
        selection: { files: [], folders: ["lib\\"] },
        expected: false // This will fail because we're comparing "lib/" with "lib\\"
    }
];

console.log("Testing folder selection logic:\n");
testCases.forEach(test => {
    const result = shouldIncludeFileFully(test.relativePath, test.selection);
    const passed = result === test.expected;
    console.log(`${test.name}: ${passed ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Path: ${test.relativePath}`);
    console.log(`  Folders: ${test.selection.folders}`);
    console.log(`  Expected: ${test.expected}, Got: ${result}`);
    console.log();
});