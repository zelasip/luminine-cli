import { GoogleGenerativeAI, Content, Part } from '@google/generative-ai';
import axios from 'axios';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { listFiles, readFileContent, writeFileContent, searchText } from './tools.js';
import shell from 'shelljs';
import { Ora } from 'ora';
import boxen from 'boxen';

dotenv.config();

let history: Content[] = [];

export function resetHistory() {
  history = [];
}

const tools = [
  {
    functionDeclarations: [
      {
        name: 'listFiles',
        description: 'List files in the current project directory based on a glob pattern.',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Glob pattern (e.g., "src/**/*.ts")' }
          }
        }
      },
      {
        name: 'readFileContent',
        description: 'Read the content of a specific file.',
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path to the file to read' }
          },
          required: ['filePath']
        }
      },
      {
        name: 'writeFileContent',
        description: 'Write content to a file, creating it if it doesn\'t exist.',
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Path to the file' },
            content: { type: 'string', description: 'The content to write' }
          },
          required: ['filePath', 'content']
        }
      },
      {
        name: 'runCommand',
        description: 'Execute a shell command.',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The shell command to run' }
          },
          required: ['command']
        }
      }
    ]
  }
];

export async function askGemini(prompt: string, spinner: Ora) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return chalk.red('Error: GEMINI_API_KEY not set.');

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      tools: tools as any
    });

    const chat = model.startChat({ history });
    let result = await chat.sendMessage(prompt);
    let response = result.response;
    
    // Handle function calls
    while (response.functionCalls()) {
      const calls = response.functionCalls() || [];
      const toolResults: any[] = [];

      for (const call of calls) {
        let toolOutput;
        const callArgs = (call.args as any);

        switch (call.name) {
          case 'listFiles':
            spinner.text = chalk.cyan(`[Tool] Listing files: ${callArgs.pattern || '*'}`);
            toolOutput = await listFiles(callArgs.pattern as string);
            break;
          case 'readFileContent':
            spinner.text = chalk.cyan(`[Tool] Reading file: ${callArgs.filePath}`);
            toolOutput = await readFileContent(callArgs.filePath as string);
            break;
          case 'writeFileContent':
            spinner.text = chalk.cyan(`[Tool] Writing file: ${callArgs.filePath}`);
            toolOutput = await writeFileContent(callArgs.filePath as string, callArgs.content as string);
            break;
          case 'runCommand':
            spinner.text = chalk.cyan(`[Tool] Running: ${callArgs.command}`);
            const shellRes = shell.exec(callArgs.command as string, { silent: true });
            toolOutput = { stdout: shellRes.stdout, stderr: shellRes.stderr, code: shellRes.code };
            console.log(boxen(shellRes.stdout || shellRes.stderr || 'Success (No output)', {
              title: `Command: ${callArgs.command}`,
              borderColor: shellRes.code === 0 ? 'green' : 'red',
              padding: 0.5,
              margin: 1
            }));
            break;
        }
        toolResults.push({
          functionResponse: {
            name: call.name,
            response: { content: toolOutput }
          }
        });
      }
      
      spinner.text = chalk.magenta('Luminine is thinking...');
      result = await chat.sendMessage(toolResults);
      response = result.response;
    }

    history = await chat.getHistory();
    return response.text();
  } catch (error: any) {
    return chalk.red(`Gemini Error: ${error.message}`);
  }
}

export async function askOpenRouter(prompt: string) {
    return "OpenRouter tool-use integration is in progress. Please use Gemini for agentic features.";
}
