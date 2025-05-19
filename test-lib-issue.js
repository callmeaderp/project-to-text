const fs = require('fs');
const path = require('path');

// Simulate the issue with lib directory not being processed

const DEFAULT_EXCLUSIONS = [
    'node_modules', '.git', '.svn', '.hg', '.DS_Store', 'Thumbs.db',
    '.dart_tool', '.idea', '.vscode', 'out', 'dist', 'build',
    '.gradle', '.cxx', '.externalNativeBuild', 'target', '*.log',
    '*.tmp', '*.temp', '.cache', '.next', '.nuxt', '.output',
    '.env', '.env.local', '.env.development', '.env.production',
    'coverage', '.nyc_output', '.pytest_cache', '__pycache__',
    '*.pyc', '.mypy_cache', '.tox', '.eggs', '*.egg-info',
    '.bundle', 'vendor/bundle', '.flutter-plugins',
    '.flutter-plugins-dependencies', '.packages', 'ephemeral',
    '.plugin_symlinks', 'pubspec.lock', 'package-lock.json',
    'yarn.lock', 'composer.lock', 'Gemfile.lock', 'poetry.lock'
];

function shouldExclude(filePath, patterns) {
    const fileName = path.basename(filePath);
    
    for (const pattern of patterns) {
        if (pattern.includes('*')) {
            // Simple glob pattern matching for test
            const regex = pattern.replace(/\*/g, '.*');
            if (new RegExp(regex).test(fileName)) {
                return true;
            }
        } else {
            // Check if any part of the path matches the pattern
            const pathParts = filePath.split(path.sep);
            for (const part of pathParts) {
                if (part === pattern) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

// Test cases
const testPaths = [
    'lib',
    'lib/main.dart',
    '/path/to/project/lib',
    '/path/to/project/lib/main.dart',
    'lib\\main.dart',
    'C:\\Users\\project\\lib',
    'C:\\Users\\project\\lib\\main.dart'
];

console.log('Testing exclusion patterns:');
console.log('Default exclusions:', DEFAULT_EXCLUSIONS.slice(0, 10), '...');
console.log('');

for (const testPath of testPaths) {
    const excluded = shouldExclude(testPath, DEFAULT_EXCLUSIONS);
    console.log(`Path: "${testPath}"`);
    console.log(`  Excluded: ${excluded}`);
    console.log('');
}

// Check if 'lib' appears in exclusions
console.log('\nChecking if "lib" is in DEFAULT_EXCLUSIONS:', DEFAULT_EXCLUSIONS.includes('lib'));
console.log('Checking if anything with "lib" is in exclusions:', 
    DEFAULT_EXCLUSIONS.filter(ex => ex.includes('lib')));