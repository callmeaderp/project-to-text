import * as fs from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';

export interface GitignorePattern {
    pattern: string;
    negate: boolean;
}

export class GitignoreParser {
    private patterns: GitignorePattern[] = [];
    private rootPath: string;

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    async load(): Promise<void> {
        const gitignorePath = path.join(this.rootPath, '.gitignore');
        
        try {
            const content = await fs.promises.readFile(gitignorePath, 'utf-8');
            this.parseContent(content);
        } catch (error) {
            // .gitignore file doesn't exist or can't be read
            // This is fine, we'll just use default exclusions
        }
    }

    private parseContent(content: string): void {
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }
            
            // Handle negation patterns
            const negate = trimmed.startsWith('!');
            const pattern = negate ? trimmed.slice(1) : trimmed;
            
            this.patterns.push({ pattern, negate });
        }
    }

    isIgnored(filePath: string): boolean {
        // Convert to relative path from root
        const relativePath = path.relative(this.rootPath, filePath);
        
        // Normalize path separators
        const normalizedPath = relativePath.replace(/\\/g, '/');
        
        let ignored = false;
        
        // Process patterns in order
        for (const { pattern, negate } of this.patterns) {
            const matches = minimatch(normalizedPath, pattern, {
                dot: true,
                matchBase: true
            });
            
            if (matches) {
                ignored = !negate;
            }
        }
        
        return ignored;
    }
}

// Common patterns to exclude by default (even without .gitignore)
export const DEFAULT_EXCLUSIONS = [
    'node_modules',
    '.git',
    '.svn',
    '.hg',
    '.DS_Store',
    'Thumbs.db',
    '.dart_tool',
    '.idea',
    '.vscode',
    'out',
    'dist',
    'build',
    '.gradle',
    '.cxx',
    '.externalNativeBuild',
    'target',
    '*.log',
    '*.tmp',
    '*.temp',
    '.cache',
    '.next',
    '.nuxt',
    '.output',
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    'coverage',
    '.nyc_output',
    '.pytest_cache',
    '__pycache__',
    '*.pyc',
    '.mypy_cache',
    '.tox',
    '.eggs',
    '*.egg-info',
    '.bundle',
    'vendor/bundle',
    '.flutter-plugins',
    '.flutter-plugins-dependencies',
    '.packages',
    'ephemeral',
    '.plugin_symlinks',
    'pubspec.lock',
    'package-lock.json',
    'yarn.lock',
    'composer.lock',
    'Gemfile.lock',
    'poetry.lock'
];

export function shouldExclude(filePath: string, patterns: string[]): boolean {
    const fileName = path.basename(filePath);
    
    for (const pattern of patterns) {
        if (pattern.includes('*')) {
            // Use minimatch for glob patterns
            if (minimatch(fileName, pattern)) {
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