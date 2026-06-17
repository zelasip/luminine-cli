import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export async function listFiles(pattern: string = '**/*') {
  try {
    let finalPattern = pattern;
    try {
      const stats = await fs.stat(pattern);
      if (stats.isDirectory()) {
        finalPattern = path.join(pattern, '**/*');
      }
    } catch (e) {
      // If stat fails, it's probably already a glob pattern or non-existent file
    }
    const files = await glob(finalPattern, { ignore: ['node_modules/**', 'dist/**', '.git/**'], nodir: true });
    return files;
  } catch (error) {
    console.error(chalk.red('Error listing files:'), error);
    return [];
  }
}

export async function readFileContent(filePath: string) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error(chalk.red(`Error reading file ${filePath}:`), error);
    return null;
  }
}

export async function writeFileContent(filePath: string, content: string) {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error(chalk.red(`Error writing to file ${filePath}:`), error);
    return false;
  }
}

export async function searchText(pattern: string, text: string) {
  try {
    const files = await listFiles(pattern);
    const results: { file: string; line: number; content: string }[] = [];
    for (const file of files) {
      const content = await readFileContent(file);
      if (content) {
        const lines = content.split('\n');
        lines.forEach((lineContent, index) => {
          if (lineContent.includes(text)) {
            results.push({ file, line: index + 1, content: lineContent.trim() });
          }
        });
      }
    }
    return results;
  } catch (error) {
    console.error(chalk.red('Error searching text:'), error);
    return [];
  }
}
