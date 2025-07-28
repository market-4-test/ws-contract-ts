import { readdir, writeFile } from 'fs/promises';
import { existsSync, lstatSync } from 'fs';
import { join, relative, basename } from 'path';

const srcDir = join(import.meta.dir, 'src');
const indexFile = join(srcDir, 'index.ts');

let content = '// This file is generated automatically. Do not edit it manually.\n\n';

async function findDirectories(startPath: string): Promise<string[]> {
    if (!existsSync(startPath)) {
        console.log("Directory not found: ", startPath);
        return [];
    }

    const items = await readdir(startPath);
    return items.filter(item => lstatSync(join(startPath, item)).isDirectory());
}

async function findFiles(startPath: string, filter: RegExp): Promise<string[]> {
    if (!existsSync(startPath)) {
        console.log("Directory not found: ", startPath);
        return [];
    }

    const files = await readdir(startPath);
    const results: string[] = [];

    for (const file of files) {
        const filename = join(startPath, file);
        const stat = lstatSync(filename);
        if (stat.isDirectory()) {
            results.push(...await findFiles(filename, filter));
        } else if (filter.test(filename)) {
            results.push(filename);
        }
    }

    return results;
}

async function generateIndex() {
    const directories = await findDirectories(srcDir);

    for (const dir of directories) {
        const dirPath = join(srcDir, dir);
        let dirExports: string[] = [];

        content += `// ${dir}\n`;
        const files = await findFiles(dirPath, /\.ts$/);

        // Create a submodule for each directory
        content += `export * as ${dir.replace(/-/g, '_')} from './${dir}';\n\n`;

        // Create a separate file for each submodule
        let subModuleContent = '';
        for (const filename of files) {
            if (basename(filename) === 'index.ts' || filename.endsWith('.client.ts')) {
                continue;
            }
            const relativePath = relative(dirPath, filename)
                .replace(/\\/g, '/') // Replace backslashes with forward slashes for Windows
                .replace(/\.ts$/, ''); // Remove .ts extension
            subModuleContent += `export * from './${relativePath}';\n`;
        }

        // Write submodule content to a separate file
        const subModuleFile = join(dirPath, 'index.ts');
        await writeFile(subModuleFile, subModuleContent, 'utf8');
    }

    await writeFile(indexFile, content.trim() + '\n', 'utf8');
    console.log(`File ${indexFile} has been successfully generated.`);
}

generateIndex().catch(console.error);