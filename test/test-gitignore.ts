import { minimatch } from 'minimatch';

// Test gitignore patterns
const patterns = [
    '*.log',
    '.dart_tool/',
    '/build/',
    '/lib/',  // This might be the culprit!
];

const testPaths = [
    'lib/main.dart',
    'lib/calculation/calculation_engine.dart',
    'build/app.apk',
    'android/app/build.gradle',
    'test.log'
];

console.log('Testing gitignore patterns:');
console.log('Patterns:', patterns);
console.log('');

for (const testPath of testPaths) {
    console.log(`Testing: ${testPath}`);
    for (const pattern of patterns) {
        const matches = minimatch(testPath, pattern, {
            dot: true,
            matchBase: true
        });
        if (matches) {
            console.log(`  MATCHED by pattern: ${pattern}`);
        }
    }
    console.log('');
}