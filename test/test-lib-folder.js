"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
    async function processDirectory(dirPath, rootPath) {
        console.log(`\nProcessing directory: ${dirPath}`);
        const items = await fs.promises.readdir(dirPath);
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stats = await fs.promises.stat(itemPath);
            const relativePath = path.relative(rootPath, itemPath);
            console.log(`Item: ${relativePath}`);
            if (stats.isDirectory()) {
                await processDirectory(itemPath, rootPath);
            }
            else {
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
//# sourceMappingURL=test-lib-folder.js.map