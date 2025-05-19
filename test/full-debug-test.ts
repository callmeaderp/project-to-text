// Full debug test
import * as fs from 'fs';
import * as path from 'path';

interface FileSelection {
    files: string[];
    folders: string[];
}

// Test the exact structure from the user's project
const testFiles = [
    { path: 'lib/main.dart', content: 'void main() { runApp(MyApp()); }' },
    { path: 'lib/calculation/calculation_engine.dart', content: 'class CalculationEngine {}' },
    { path: 'lib/data/database/DatabaseHelper.dart', content: 'class DatabaseHelper {}' },
    { path: 'android/app/build.gradle.kts', content: 'plugins { id("com.android.application") }' },
    { path: '.gitignore', content: '*.log\n.DS_Store\n' }
];

async function createTestProject() {
    const baseDir = '/tmp/flutter-test-project';
    
    // Create test files
    for (const file of testFiles) {
        const fullPath = path.join(baseDir, file.path);
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.promises.writeFile(fullPath, file.content);
    }
    
    return baseDir;
}

async function testProcessing() {
    const rootPath = await createTestProject();
    const selection: FileSelection = {
        files: [],
        folders: ['lib']
    };
    
    console.log('Testing with Flutter project structure');
    console.log('Root path:', rootPath);
    console.log('Selection:', JSON.stringify(selection, null, 2));
    console.log('\n--- Processing ---\n');
    
    const output: string[] = [];
    await processDirectory(rootPath, rootPath, selection, output);
    
    console.log('\n--- Output ---');
    console.log(output.join('\n'));
    
    // Count lib files in output
    const libFiles = output.filter(line => line.includes('FILE: lib/'));
    console.log(`\n--- Found ${libFiles.length} lib files in output ---`);
    libFiles.forEach(file => console.log(file));
}

async function processDirectory(dirPath: string, rootPath: string, selection: FileSelection, output: string[]): Promise<void> {
    const items = await fs.promises.readdir(dirPath);
    const relativeDirPath = path.relative(rootPath, dirPath);
    console.log(`Processing directory: ${relativeDirPath || '(root)'}`);
    
    for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.promises.stat(itemPath);
        const relativePath = path.relative(rootPath, itemPath);
        
        if (stats.isDirectory()) {
            console.log(`  Directory: ${relativePath}`);
            await processDirectory(itemPath, rootPath, selection, output);
        } else {
            const shouldIncludeFully = shouldIncludeFileFully(relativePath, selection);
            console.log(`  File: ${relativePath} - include fully: ${shouldIncludeFully}`);
            await processFile(itemPath, relativePath, shouldIncludeFully, output);
        }
    }
}

function shouldIncludeFileFully(relativePath: string, selection: FileSelection): boolean {
    if (selection.files.length === 0 && selection.folders.length === 0) {
        return true;
    }
    
    const normalizedPath = relativePath.replace(/\\/g, '/');
    
    for (const folder of selection.folders) {
        const normalizedFolder = folder.replace(/\\/g, '/');
        if (normalizedPath.startsWith(normalizedFolder + '/') || normalizedPath === normalizedFolder) {
            return true;
        }
    }
    
    return false;
}

async function processFile(filePath: string, relativePath: string, includeFully: boolean, output: string[]): Promise<void> {
    const displayPath = relativePath.replace(/\\/g, '/');
    output.push('================================================');
    output.push(`FILE: ${displayPath}${includeFully ? '' : ' (preview only)'}`);
    output.push('================================================');
    
    try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        
        if (includeFully) {
            output.push(content);
        } else {
            output.push(lines.slice(0, 5).join('\n'));
            if (lines.length > 5) {
                output.push('...');
                output.push(`[FILE TRUNCATED - showing 5 of ${lines.length} lines]`);
            }
        }
    } catch (error) {
        output.push(`Error reading file: ${error}`);
    }
    
    output.push('');
    output.push('');
}

testProcessing().catch(console.error);