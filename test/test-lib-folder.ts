import * as fs from 'fs';
import * as path from 'path';

// Create a test setup
const testDir = path.join(__dirname, 'test-project');
const libDir = path.join(testDir, 'lib');

// Setup test directory structure
async function setup() {
    // Clean up if exists
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
    
    // Create directories
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(libDir, { recursive: true });
    
    // Create test files
    fs.writeFileSync(path.join(testDir, 'index.js'), 'console.log("root");');
    fs.writeFileSync(path.join(libDir, 'helper.js'), 'console.log("lib helper");');
    fs.writeFileSync(path.join(libDir, 'utils.js'), 'console.log("lib utils");');
    
    console.log('Test directory structure created:');
    console.log('test-project/');
    console.log('  index.js');
    console.log('  lib/');
    console.log('    helper.js');
    console.log('    utils.js');
}

// Test the selection logic
async function test() {
    const rootPath = testDir;
    const selection = { files: [], folders: ['lib'] };
    
    console.log('\nTesting with selection:', selection);
    
    // Simulate processDirectory
    async function processDirectory(dirPath: string, rootPath: string) {
        console.log(`\nProcessing directory: ${dirPath}`);
        const items = await fs.promises.readdir(dirPath);
        
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stats = await fs.promises.stat(itemPath);
            const relativePath = path.relative(rootPath, itemPath);
            
            console.log(`Item: ${relativePath}`);
            
            if (stats.isDirectory()) {
                await processDirectory(itemPath, rootPath);
            } else {
                // Test shouldIncludeFileFully logic
                const normalizedPath = relativePath.replace(/\\/g, '/');
                let shouldInclude = false;
                
                for (const folder of selection.folders) {
                    const normalizedFolder = folder.replace(/\\/g, '/');
                    if (normalizedPath.startsWith(normalizedFolder + '/')) {
                        shouldInclude = true;
                        break;
                    }
                }
                
                console.log(`  Should include "${relativePath}" fully? ${shouldInclude}`);
                console.log(`  Normalized: "${normalizedPath}"`);
                console.log(`  Checking: starts with "lib/"? ${normalizedPath.startsWith('lib/')}`);
            }
        }
    }
    
    await processDirectory(rootPath, rootPath);
}

// Run test
(async () => {
    await setup();
    await test();
})();