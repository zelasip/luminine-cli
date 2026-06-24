import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import axios from 'axios';
// @ts-ignore
import googleIt from 'google-it';

async function confirmPathAccess(filePath: string): Promise<boolean> {
  const absolutePath = path.resolve(filePath);
  const root = process.cwd();

  if (absolutePath.startsWith(root)) {
    return true;
  }

  console.log(chalk.yellow(`\n⚠️  Agent is trying to access: ${absolutePath}`));
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'Outside workspace directory detected. Allow access?',
    choices: [
      { name: 'Allow Once', value: 'allow' },
      { name: 'Deny & Explain', value: 'deny' }
    ]
  }]);

  return action === 'allow';
}

export async function listFiles(pattern: string = '**/*') {
  try {
    let finalPattern = pattern;
    // Basic check for pattern
    if (!await confirmPathAccess(pattern)) return [];

    try {
      const stats = await fs.stat(pattern);
      if (stats.isDirectory()) {
        finalPattern = path.join(pattern, '**/*');
      }
    } catch (e) {}
    const files = await glob(finalPattern, { ignore: ['node_modules/**', 'dist/**', '.git/**'], nodir: true });
    return files;
  } catch (error) {
    console.error(chalk.red('Error listing files:'), error);
    return [];
  }
}

export async function readFileContent(filePath: string) {
  try {
    if (!await confirmPathAccess(filePath)) return 'Access denied by user.';
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error(chalk.red(`Error reading file ${filePath}:`), error);
    return null;
  }
}

export async function writeFileContent(filePath: string, content: string) {
  try {
    if (!await confirmPathAccess(filePath)) return false;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error(chalk.red(`Error writing to file ${filePath}:`), error);
    return false;
  }
}
// ... rest of tools.ts

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

export async function searchWeb(query: string) {
  try {
    const results = await googleIt({ query, limit: 5 });
    return results.map((r: any) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet
    }));
  } catch (error) {
    console.error(chalk.red('Error searching web:'), error);
    return [];
  }
}

export async function generateImage(prompt: string): Promise<string | null> {
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;
    
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 60000 
    });
    
    const filename = `image_${Date.now()}.png`;
    const filePath = path.join(process.cwd(), filename);
    await fs.writeFile(filePath, Buffer.from(response.data));
    
    return filePath;
  } catch (error) {
    console.error(chalk.red('Error generating image:'), error);
    return null;
  }
}
