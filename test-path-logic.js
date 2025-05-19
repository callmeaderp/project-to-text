const path = require('path');

// Test the path normalization logic
function testPathNormalization() {
    const testCases = [
        { input: '/lib', expected: 'lib' },
        { input: 'lib', expected: 'lib' },
        { input: 'lib/', expected: 'lib' },
        { input: '/lib/', expected: 'lib' },
        { input: 'lib\\subfolder', expected: 'lib' }
    ];

    console.log('Testing path normalization:');
    testCases.forEach(test => {
        let cleanItem = test.input.startsWith('/') ? test.input.substring(1) : test.input;
        cleanItem = cleanItem.endsWith('/') ? cleanItem.slice(0, -1) : cleanItem;
        console.log(`Input: "${test.input}" -> Cleaned: "${cleanItem}" (expected: "${test.expected}")`);
    });
}

// Test the path comparison logic
function testPathComparison() {
    const filePaths = [
        'lib/main.dart',
        'lib\\main.dart',
        'lib/calculation/calculation_engine.dart',
        'lib\\calculation\\calculation_engine.dart'
    ];
    
    const selectedFolders = ['lib'];
    
    console.log('\nTesting path comparison:');
    console.log('Selected folders:', selectedFolders);
    
    filePaths.forEach(filePath => {
        const normalizedPath = filePath.replace(/\\/g, '/');
        console.log(`\nFile path: "${filePath}"`);
        console.log(`Normalized: "${normalizedPath}"`);
        
        for (const folder of selectedFolders) {
            const normalizedFolder = folder.replace(/\\/g, '/');
            const isMatch = normalizedPath.startsWith(normalizedFolder + '/') || normalizedPath === normalizedFolder;
            console.log(`  Checking against folder "${folder}": ${isMatch ? 'MATCH' : 'NO MATCH'}`);
        }
    });
}

testPathNormalization();
testPathComparison();