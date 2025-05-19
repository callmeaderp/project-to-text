// Test to reproduce the exact issue
import * as fs from 'fs';
import * as path from 'path';

// Simulate the Flutter project structure
const testStructure = {
    'validation_app': {
        '.gitignore': '# File content',
        'lib': {
            'main.dart': 'void main() {}',
            'calculation': {
                'calculation_engine.dart': 'class Engine {}'
            }
        },
        'android': {
            'app': {
                'build.gradle.kts': 'plugins {}'
            }
        }
    }
};

// Create the structure in a temp directory
const tempDir = '/tmp/test-flutter-project';

async function createStructure(basePath: string, structure: any) {
    await fs.promises.mkdir(basePath, { recursive: true });
    
    for (const [name, content] of Object.entries(structure)) {
        const fullPath = path.join(basePath, name);
        
        if (typeof content === 'string') {
            await fs.promises.writeFile(fullPath, content);
        } else {
            await createStructure(fullPath, content);
        }
    }
}

async function test() {
    console.log('Creating test structure...');
    await createStructure(tempDir, testStructure);
    
    // Now test the function
    const selection = {
        files: [],
        folders: ['lib']
    };
    
    console.log('Testing with selection:', selection);
    
    // Simulate processing
    await processTestDirectory(path.join(tempDir, 'validation_app'), selection);
}

async function processTestDirectory(rootPath: string, selection: { files: string[], folders: string[] }) {
    console.log(`\nProcessing root: ${rootPath}`);
    console.log('Selected folders:', selection.folders);
    
    async function walkDir(dirPath: string, indent = '') {
        const items = await fs.promises.readdir(dirPath);
        
        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const relativePath = path.relative(rootPath, fullPath);
            const stats = await fs.promises.stat(fullPath);
            
            console.log(`${indent}Found: ${relativePath}`);
            
            if (stats.isDirectory()) {
                console.log(`${indent}  Type: Directory`);
                await walkDir(fullPath, indent + '  ');
            } else {
                const shouldInclude = checkIfShouldInclude(relativePath, selection);
                console.log(`${indent}  Type: File`);
                console.log(`${indent}  Should include fully: ${shouldInclude}`);
            }
        }
    }
    
    await walkDir(rootPath);
}

function checkIfShouldInclude(relativePath: string, selection: { files: string[], folders: string[] }): boolean {
    const normalizedPath = relativePath.replace(/\\/g, '/');
    console.log(`    Checking: "${normalizedPath}"`);
    
    for (const folder of selection.folders) {
        const normalizedFolder = folder.replace(/\\/g, '/');
        console.log(`    Against folder: "${normalizedFolder}"`);
        
        if (normalizedPath.startsWith(normalizedFolder + '/') || normalizedPath === normalizedFolder) {
            return true;
        }
    }
    
    return false;
}

test().catch(console.error);