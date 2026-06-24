import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import axios from 'axios';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { listFiles, readFileContent, writeFileContent, searchText, searchWeb, generateImage } from './tools.js';
import shell from 'shelljs';
import { Ora } from 'ora';
import boxen from 'boxen';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

let luminineMessages: any[] = [];
const LUMININE_API_URL = process.env.LUMININE_API_URL || 'https://use-ai-production.up.railway.app/v1/chat/completions';
let allowAllSession = false;

export function setAllowAllSession(val: boolean) { allowAllSession = val; }
export function getAllowAllSession() { return allowAllSession; }

function normalizeLuminineModel(model: string) {
  return model.replace(/^gpt-5\.5$/, 'gpt-5-5').replace(/^gpt-5\.4$/, 'gpt-5-4').replace(/^gpt-5\.3$/, 'gpt-5-3').replace(/^gpt-5\.1$/, 'gpt-5-1');
}

let history: Content[] = [];
let activeSkills: string[] = [];
const HISTORY_FILE = '.luminine_history.json';
const MEMORY_FILE = '.luminine_memory.json';
const CONSTRAINTS_FILE = '.luminine_constraints.json';

const MODEL_FALLBACK_LIST = [
  'gemini-3.5-flash',
  'gemini-3-flash',
  'gemma-4-31b',
  'gemma-4-26b',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite'
];

export const SUPPORTED_MODELS = {
  'gemini': {
    name: 'Google Gemini',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp', ...MODEL_FALLBACK_LIST]
  },
  'openrouter': {
    name: 'OpenRouter',
    models: ['openrouter/auto', 'meta-llama/llama-3.1-405b', 'anthropic/claude-3.5-sonnet', 'google/gemini-flash-1.5']
  },
  'anthropic': {
    name: 'Anthropic',
    models: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307']
  },
  'openai': {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo']
  },
  'custom': {
    name: 'Custom Provider',
    models: ['default']
  },
  'luminine': {
    name: 'Luminine AI',
    models: [
      'gpt-5-5', 'gpt-5-4', 'gpt-5-3', 'gpt-5-1', 'gpt-5', 'gpt-5-mini',
      'gpt-4o', 'gpt-4o-mini',
      'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-opus-4-5', 'claude-opus-4-1', 'claude-sonnet-4-6',
      'gemini-3-1-pro', 'gemini-3-pro', 'gemini-3-flash', 'gemini-2.5-flash',
      'deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-r1',
      'grok-4', 'qwen-3-max', 'qwen-3-5-397b', 'kimi-k2-6', 'deepinfra-kimi-k2', 'llama-3-3-70b-versatileile'
    ]
  },
  'auto': {
    name: 'Auto (Smart Selection)',
    models: ['auto']
  }
};

const CLAUDE_CODE_PERSONA = `
You are Luminine, a CLI coding assistant. You execute tasks via tools.
RULES:
1. NO filler. No "I will", "Okay", "Done", "Let me". Zero wasted tokens.
2. If task needs a tool → output ONLY the tool call line. Nothing else.
3. If task needs info first → use listFiles/readFileContent, then tool call.
4. Final answer → max 1-2 sentences. Be direct.
5. Language: match user's language.
6. Stay in ALLOWED_ROOT_DIRECTORY.
7. When writing files, output the tool call then the content in a code block.
`.trim();

export function getHistory() { return history; }
export function setHistory(newHistory: Content[]) { history = newHistory; }

export async function saveSession() {
  try {
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
    return true;
  } catch (e) { return false; }
}

export async function loadSession() {
  try {
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    history = JSON.parse(data);
    return true;
  } catch (e) { return false; }
}

export async function updateMemory(fact: string) {
  try {
    let memory = [];
    try {
      const data = await fs.readFile(MEMORY_FILE, 'utf-8');
      memory = JSON.parse(data);
    } catch (e) {}
    if (!memory.some((m: any) => m.fact === fact)) {
        memory.push({ fact, date: new Date().toISOString() });
        await fs.writeFile(MEMORY_FILE, JSON.stringify(memory, null, 2));
    }
    return `Memory updated: ${fact}`;
  } catch (e) { return "Failed to update memory"; }
}

export async function updateConstraint(constraint: string) {
  try {
    let constraints = [];
    try {
      const data = await fs.readFile(CONSTRAINTS_FILE, 'utf-8');
      constraints = JSON.parse(data);
    } catch (e) {}
    if (!constraints.includes(constraint)) {
        constraints.push(constraint);
        await fs.writeFile(CONSTRAINTS_FILE, JSON.stringify(constraints, null, 2));
    }
    return `Constraint added: ${constraint}`;
  } catch (e) { return "Failed to update constraints"; }
}

export function resetHistory() {
  history = [];
  openRouterMessages = [];
  gpt55Messages = [];
}

export function rewindHistory(n: number) {
  history = history.slice(0, Math.max(0, history.length - n));
  openRouterMessages = openRouterMessages.slice(0, Math.max(0, openRouterMessages.length - n));
  gpt55Messages = gpt55Messages.slice(0, Math.max(0, gpt55Messages.length - n));
  return `Rewound ${n} messages.`;
}

export async function getAvailableSkills() {
  try {
    const files = await fs.readdir('skills');
    return files.filter(f => f.endsWith('.md') || f.endsWith('.SKILL.md')).map(f => f.replace('.md', '').replace('.SKILL', ''));
  } catch (e) {
    return [];
  }
}

export async function activateSkill(skillName: string) {
  try {
    let skillPath = path.join('skills', `${skillName}.md`);
    if (!(await fs.stat(skillPath).catch(() => null))) {
        skillPath = path.join('skills', `${skillName}.SKILL.md`);
    }
    const content = await fs.readFile(skillPath, 'utf-8');
    if (!activeSkills.includes(skillName)) activeSkills.push(skillName);
    
    history.push({
      role: 'user',
      parts: [{ text: `SYSTEM: Skill "${skillName}" activated. Instructions:
${content}` }]
    });
    return true;
  } catch (e) {
    return false;
  }
}

export async function compressHistory(spinner: Ora) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return false;
    
    spinner.text = chalk.yellow('Compressing conversation history...');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const context = history.map(h => `${h.role}: ${h.parts[0].text}`).join('\n');
    const prompt = `Summarize the following conversation history into a concise "Memory" block. Capture user identity, preferences, and important project decisions. This will be used to reset the context while keeping relevant info.\n\n${context}`;
    
    const result = await model.generateContent(prompt);
    const summary = result.response.text();
    
    history = [
        { role: 'user', parts: [{ text: `SYSTEM: Context compressed. Previous session summary:\n${summary}` }] }
    ];
    return true;
}

const openRouterTools = [
  {
    type: "function",
    function: {
      name: "listFiles",
      description: "List files in the current project directory.",
      parameters: {
        type: "object",
        properties: { pattern: { type: "string", description: "Glob pattern" } },
        required: ["pattern"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "readFileContent",
      description: "Read the content of a file.",
      parameters: {
        type: "object",
        properties: { filePath: { type: "string", description: "Path to file" } },
        required: ["filePath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "writeFileContent",
      description: "Create or overwrite a file with content.",
      parameters: {
        type: "object",
        properties: { 
          filePath: { type: "string", description: "Path to file" },
          content: { type: "string", description: "Content to write" }
        },
        required: ["filePath", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "runCommand",
      description: "Execute a shell command.",
      parameters: {
        type: "object",
        properties: { command: { type: "string", description: "Command to run" } },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "updateConstraint",
      description: "Save a user-imposed constraint.",
      parameters: {
        type: "object",
        properties: { constraint: { type: "string" } },
        required: ["constraint"]
      }
    }
  }
];

const geminiTools = {
    functionDeclarations: openRouterTools.map(t => t.function)
};

async function executeTool(name: string, args: any, spinner: Ora) {
  let toolOutput;
  switch (name) {
    case 'listFiles':
      toolOutput = await listFiles(args.pattern as string);
      break;
    case 'readFileContent':
      toolOutput = await readFileContent(args.filePath as string);
      break;
    case 'writeFileContent':
      toolOutput = await writeFileContent(args.filePath as string, args.content as string);
      break;
    case 'runCommand': {
      const cmd = args.command as string;
      
      if (!allowAllSession) {
        spinner.stop();
        const cmdPreview = cmd.length > 55 ? cmd.substring(0, 55) + '...' : cmd;
        
        const border = '╭' + '─'.repeat(62) + '╮';
        const borderBottom = '╰' + '─'.repeat(62) + '╯';
        const emptyLine = '│' + ' '.repeat(62) + '│';
        
        console.log('');
        console.log(chalk.cyan(border));
        console.log(chalk.cyan('│') + chalk.bold.cyan(' ? Shell ') + chalk.cyan(' '.repeat(52) + '│'));
        console.log(chalk.cyan('│') + ' '.repeat(62) + chalk.cyan('│'));
        console.log(chalk.cyan('│') + chalk.white('  ' + cmdPreview) + ' '.repeat(60 - cmdPreview.length - 2) + chalk.cyan('│'));
        console.log(chalk.cyan(emptyLine));
        console.log(chalk.cyan('│') + chalk.yellow('  Allow execution of [Shell]?') + ' '.repeat(33) + chalk.cyan('│'));
        console.log(chalk.cyan(emptyLine));
        
        const { choice } = await inquirer.prompt([{
          type: 'list',
          name: 'choice',
          message: chalk.cyan(''),
          choices: [
            { name: chalk.green('● Allow once'), value: 'once' },
            { name: chalk.white('  Allow for this session'), value: 'session' },
            { name: chalk.red('  No, suggest changes (esc)'), value: 'no' }
          ],
          pageSize: 3
        }]);
        
        console.log(chalk.cyan(borderBottom));
        console.log('');
        
        if (choice === 'no') {
          toolOutput = { stdout: 'Command cancelled by user.', stderr: '', code: 1 };
          break;
        } else if (choice === 'session') {
          allowAllSession = true;
          console.log(chalk.green('  ✓ All commands allowed for this session. (Ctrl+Y to toggle)\n'));
        }
      }
      
      const bgKeywords = ['python ', 'node ', 'npm run', 'yarn ', 'pnpm ', 'serve', 'http.server', 'flask', 'django', 'uvicorn', 'gunicorn', 'nohup', '&'];
      const isBg = bgKeywords.some(kw => cmd.includes(kw)) || cmd.endsWith('&');
      
      if (isBg) {
        const cleanCmd = cmd.replace(/\s*&$/, '').trim();
        shell.exec(cleanCmd + ' > /dev/null 2>&1 &', { silent: true });
        toolOutput = { stdout: `Command started in background: ${cleanCmd}`, stderr: '', code: 0 };
      } else {
        const shellRes = shell.exec(cmd, { silent: true, timeout: 30000 });
        toolOutput = { stdout: shellRes.stdout, stderr: shellRes.stderr, code: shellRes.code };
      }
      break;
    }
    case 'searchWeb':
      toolOutput = await searchWeb(args.query as string);
      break;
    case 'generateImage': {
      spinner.text = chalk.magenta('Generating image...');
      const imgPath = await generateImage(args.prompt as string);
      if (imgPath) {
        toolOutput = { success: true, path: imgPath, message: `Image saved to ${imgPath}` };
        console.log(chalk.green(`\n  ✓ Image generated: ${imgPath}\n`));
      } else {
        toolOutput = { success: false, message: 'Failed to generate image' };
      }
      break;
    }
    case 'updateMemory':
      spinner.text = chalk.yellow(`[Agent] Remembering fact...`);
      toolOutput = await updateMemory(args.fact as string);
      break;
    case 'updateConstraint':
      spinner.text = chalk.yellow(`[Agent] Storing constraint...`);
      toolOutput = await updateConstraint(args.constraint as string);
      break;
    default:
      toolOutput = "Unknown tool";
  }
  return toolOutput;
}

async function buildSystemContext() {
  let contextParts = [CLAUDE_CODE_PERSONA];
  
  contextParts.push(`CWD: ${process.cwd()}`);

  try {
      const memData = await fs.readFile(MEMORY_FILE, 'utf-8');
      const mem = JSON.parse(memData);
      contextParts.push(`USER_FACTS:\n${mem.map((m: any) => `- ${m.fact}`).join('\n')}`);
  } catch(e) {}
  try {
      const conData = await fs.readFile(CONSTRAINTS_FILE, 'utf-8');
      const cons = JSON.parse(conData);
      contextParts.push(`CONSTRAINTS:\n${cons.map((c: any) => `- ${c}`).join('\n')}`);
  } catch(e) {}

  return contextParts.join('\n\n');
}

export async function askGemini(prompt: string, spinner: Ora) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return chalk.red('Error: GEMINI_API_KEY not set.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const systemInstructions = await buildSystemContext();

  for (const modelName of MODEL_FALLBACK_LIST) {
    try {
      spinner.text = chalk.magenta(`Thinking using ${modelName}...`);
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        tools: [geminiTools] as any,
        systemInstruction: systemInstructions
      });

      const chat = model.startChat({ history });
      let result = await chat.sendMessage(prompt);
      let response = result.response;
      
      while (response.functionCalls()) {
        const calls = response.functionCalls() || [];
        const toolResults: any[] = [];

        for (const call of calls) {
          const toolOutput = await executeTool(call.name, call.args, spinner);
          toolResults.push({
            functionResponse: { name: call.name, response: { content: toolOutput } }
          });
        }
        
        spinner.text = chalk.magenta('Luminine is processing tool results...');
        result = await chat.sendMessage(toolResults);
        response = result.response;
      }

      history = await chat.getHistory();
      await saveSession();
      return response.text();

    } catch (error: any) {
      if (modelName === MODEL_FALLBACK_LIST[MODEL_FALLBACK_LIST.length - 1]) {
        return chalk.red(`All models failed. Last error (${modelName}): ${error.message}`);
      }
      spinner.text = chalk.yellow(`${modelName} failed, trying next...`);
      continue;
    }
  }
  return chalk.red('Critical Error: Fallback loop exited without result.');
}

let openRouterMessages: any[] = [];
let gpt55Messages: any[] = [];

export async function askOpenRouter(prompt: string, spinner: Ora) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return chalk.red('Error: OPENROUTER_API_KEY not set.');

  const model = process.env.LUMININE_MODEL || 'openrouter/free';
  const systemInstructions = await buildSystemContext();

  if (openRouterMessages.length === 0) {
      openRouterMessages.push({ role: "system", content: systemInstructions });
  }
  openRouterMessages.push({ role: "user", content: prompt });

  try {
    let keepCalling = true;
    while(keepCalling) {
        spinner.text = chalk.magenta(`Querying OpenRouter (${model})...`);
        const openRouterUrl = process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1/chat/completions';
        const httpReferer = process.env.HTTP_REFERER || 'https://luminine-cli.com';
        const response: any = await axios.post(
          openRouterUrl,
          {
            model: model,
            messages: openRouterMessages,
            tools: openRouterTools
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': httpReferer,
              'X-Title': 'Luminine CLI',
            },
          }
        );

        const responseMsg = response.data.choices[0].message;
        openRouterMessages.push(responseMsg);

        if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
            spinner.text = chalk.cyan('[Agent] Executing Tools via OpenRouter...');
            for (const toolCall of responseMsg.tool_calls) {
                const funcName = toolCall.function.name;
                const funcArgs = JSON.parse(toolCall.function.arguments);
                const toolOutput = await executeTool(funcName, funcArgs, spinner);
                
                openRouterMessages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: funcName,
                    content: JSON.stringify(toolOutput)
                });
            }
        } else {
            keepCalling = false;
        }
    }

    history.push({ role: 'user', parts: [{text: prompt}] });
    history.push({ role: 'model', parts: [{text: openRouterMessages[openRouterMessages.length-1].content || ""}] });
    await saveSession();

    return openRouterMessages[openRouterMessages.length-1].content;
  } catch (error: any) {
    return chalk.red(`OpenRouter Error: ${error.response?.data?.error?.message || error.message}`);
  }
}

export async function askAnthropic(prompt: string, spinner: Ora) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return chalk.red('Error: ANTHROPIC_API_KEY not set.');
    const anthropic = new Anthropic({ apiKey });
    const model = process.env.LUMININE_MODEL || 'claude-3-5-sonnet-20240620';
    const systemInstructions = await buildSystemContext();

    try {
        spinner.text = chalk.magenta(`Querying Anthropic (${model})...`);
        const message = await anthropic.messages.create({
            model: model,
            max_tokens: 4096,
            system: systemInstructions,
            messages: [{ role: 'user', content: prompt }],
        });
        return (message.content[0] as any).text;
    } catch (error: any) {
        return chalk.red(`Anthropic Error: ${error.message}`);
    }
}

export async function askOpenAI(prompt: string, spinner: Ora) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return chalk.red('Error: OPENAI_API_KEY not set.');
    const openai = new OpenAI({ apiKey });
    const model = process.env.LUMININE_MODEL || 'gpt-4o';
    const systemInstructions = await buildSystemContext();

    try {
        spinner.text = chalk.magenta(`Querying OpenAI (${model})...`);
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: systemInstructions },
                { role: "user", content: prompt }
            ],
        });
        return response.choices[0].message.content;
    } catch (error: any) {
        return chalk.red(`OpenAI Error: ${error.message}`);
    }
}

export async function askCustom(prompt: string, spinner: Ora) {
    const apiKey = process.env.CUSTOM_API_KEY;
    const baseURL = process.env.CUSTOM_BASE_URL;
    if (!apiKey || !baseURL) return chalk.red('Error: CUSTOM_API_KEY or CUSTOM_BASE_URL not set.');
    const openai = new OpenAI({ apiKey, baseURL });
    const model = process.env.LUMININE_MODEL || 'default';
    const systemInstructions = await buildSystemContext();

    try {
        spinner.text = chalk.magenta(`Querying Custom Provider (${baseURL})...`);
        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: "system", content: systemInstructions },
                { role: "user", content: prompt }
            ],
        });
        return response.choices[0].message.content;
    } catch (error: any) {
        return chalk.red(`Custom Error: ${error.message}`);
    }
}

export async function askLuminineAI(prompt: string, spinner: Ora) {
  const model = normalizeLuminineModel(process.env.LUMININE_MODEL || 'gpt-5-5');
  const systemInstructions = await buildSystemContext();

  const toolDefs = `
TOOLS (output ONLY the line, nothing else):
[Tool call: runCommand with command "cmd"]
[Tool call: writeFileContent with path "file"]\n\`\`\`\ncontent\n\`\`\`
[Tool call: listFiles with pattern "glob"]
[Tool call: readFileContent with path "file"]
[Tool call: searchWeb with query "text"]
[Tool call: generateImage with prompt "desc"]
`.trim();

  if (luminineMessages.length === 0) luminineMessages.push({ role: 'system', content: systemInstructions + '\n\n' + toolDefs });
  luminineMessages.push({ role: 'user', content: prompt });

  try {
    while (true) {
      spinner.text = `Querying Luminine AI (${model})...`;
      const headers = { 'Content-Type': 'application/json', Authorization: process.env.LUMININE_API_KEY ? `Bearer ${process.env.LUMININE_API_KEY}` : '' };
      
      // Streaming request
      const response = await axios.post(LUMININE_API_URL, { 
        model, 
        messages: luminineMessages, 
        tools: openRouterTools,
        stream: true
      }, { headers, responseType: 'stream' });
      
      let fullContent = '';
      const toolCalls: any[] = [];
      
      await new Promise<void>((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter(l => l.startsWith('data: '));
          for (const line of lines) {
            const data = line.slice(6);
            if (data === '[DONE]') { resolve(); return; }
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                fullContent += delta.content;
                spinner.text = chalk.gray(fullContent.slice(-60));
              }
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: tc.id, function: { name: '', arguments: '' } };
                  if (tc.id) toolCalls[tc.index].id = tc.id;
                  if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
                  if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                }
              }
            } catch (e) {}
          }
        });
        response.data.on('end', () => resolve());
        response.data.on('error', (err: any) => reject(err));
      });

      const responseMsg: any = { role: 'assistant', content: fullContent };
      if (toolCalls.length > 0) responseMsg.tool_calls = toolCalls.filter(Boolean);

      luminineMessages.push(responseMsg);

      if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
        spinner.text = 'Agent is using tools...';
        for (const toolCall of responseMsg.tool_calls) {
          const funcName = toolCall.function.name;
          const funcArgs = JSON.parse(toolCall.function.arguments);
          const toolOutput = await executeTool(funcName, funcArgs, spinner);
          
          luminineMessages.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: funcName,
            content: JSON.stringify(toolOutput)
          });
        }
        continue;
      } else if (responseMsg.content && /(\[Tool call:|writeFileContent|runCommand|listFiles|readFileContent|searchWeb|generateImage)/.test(responseMsg.content)) {
        spinner.text = 'Agent is simulating tools in text. Converting to real calls...';
        const content = responseMsg.content;
        
        let foundTool = false;
        
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.tool && parsed.tool.name) {
                    const toolOutput = await executeTool(parsed.tool.name, parsed.tool.args || {}, spinner);
                    luminineMessages.push({
                        role: 'tool',
                        name: parsed.tool.name,
                        content: JSON.stringify(toolOutput)
                    });
                    foundTool = true;
                }
            } catch (e) {}
        }

        // Find ALL tool calls in the response
            const toolCallRegex = /\[Tool call:\s*(\w+)\s+with\s+(\w+)\s+[\"']([^\"']+)[\"']\]/g;
            const codeBlocks = content.match(/```\w*\n([\s\S]*?)```/g) || [];
            let codeBlockIdx = 0;
            let match;
            
            while ((match = toolCallRegex.exec(content)) !== null) {
                foundTool = true;
                const toolName = match[1];
                const argName = match[2];
                const argValue = match[3].trim();
                const args: any = {};
                
                if (toolName === 'writeFileContent') {
                    args.filePath = argValue;
                    args.content = codeBlocks[codeBlockIdx] ? codeBlocks[codeBlockIdx].replace(/```\w*\n?/, '').replace(/```$/, '').trim() : '';
                    codeBlockIdx++;
                } else if (toolName === 'runCommand') {
                    args.command = argValue;
                } else if (toolName === 'listFiles') {
                    args.pattern = argValue;
                } else if (toolName === 'readFileContent') {
                    args.filePath = argValue;
                } else if (toolName === 'searchWeb') {
                    args.query = argValue;
                } else if (toolName === 'generateImage') {
                    args.prompt = argValue;
                }
                
                const toolOutput = await executeTool(toolName, args, spinner);
                luminineMessages.push({
                    role: 'tool',
                    name: toolName,
                    content: JSON.stringify(toolOutput)
                });
            }

        if (foundTool) {
          continue; 
        } else {
          const finalContent = responseMsg.content || '';
          history.push({ role: 'user', parts: [{ text: prompt }] });
          history.push({ role: 'model', parts: [{ text: finalContent }] });
          await saveSession();
          return finalContent;
        }
      } else {
        const content = responseMsg.content || '';
        history.push({ role: 'user', parts: [{ text: prompt }] });
        history.push({ role: 'model', parts: [{ text: content }] });
        await saveSession();
        return content;
      }
    }
  } catch (error: any) {
    return `Luminine AI Error: ${error.message}`;
  }
}

export async function askGpt5_5(prompt: string, spinner: Ora) {
    const baseURL = process.env.GPT55_BASE_URL || "https://theproxy-production-e112.up.railway.app/v1";
    const apiKey = process.env.GPT55_API_KEY || "admin";
    const model = "gpt-5.5";
    const systemInstructions = await buildSystemContext();

    const gpt55ToolDefs = `
TOOLS (output ONLY the line, nothing else):
[Tool call: runCommand with command "cmd"]
[Tool call: writeFileContent with path "file"]\n\`\`\`\ncontent\n\`\`\`
[Tool call: listFiles with pattern "glob"]
[Tool call: readFileContent with path "file"]
[Tool call: searchWeb with query "text"]
[Tool call: generateImage with prompt "desc"]
`.trim();

    if (gpt55Messages.length === 0) {
        gpt55Messages.push({ role: "system", content: systemInstructions + '\n\n' + gpt55ToolDefs });
    }
    gpt55Messages.push({ role: "user", content: prompt });

    try {
        const openai = new OpenAI({ apiKey, baseURL });
        
        while (true) {
            spinner.text = chalk.magenta(`Querying Luminine AI (${model})...`);

            const response = await openai.chat.completions.create({
                model: model,
                messages: gpt55Messages,
                tools: openRouterTools as any
            });
            
            const responseMsg = response.choices[0].message;
            gpt55Messages.push(responseMsg);
            
            if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
                spinner.text = chalk.cyan('[Agent] Executing Tools via Luminine AI...');
                for (const toolCall of responseMsg.tool_calls) {
                    const funcName = (toolCall as any).function.name;
                    const funcArgs = JSON.parse((toolCall as any).function.arguments);
                    const toolOutput = await executeTool(funcName, funcArgs, spinner);
                    
                    gpt55Messages.push({
                        tool_call_id: toolCall.id,
                        role: "tool",
                        content: JSON.stringify(toolOutput)
                    });
                }
            } else if (responseMsg.content && /(\[Tool call:)/.test(responseMsg.content)) {
                spinner.text = chalk.cyan('[Agent] Executing tools...');
                const content = responseMsg.content;
                let foundTool = false;
                
                const toolCallRegex = /\[Tool call:\s*(\w+)\s+with\s+(\w+)\s+[\"']([^\"']+)[\"']\]/g;
                const codeBlocks = content.match(/```\w*\n([\s\S]*?)```/g) || [];
                let codeBlockIdx = 0;
                let match;
                
                while ((match = toolCallRegex.exec(content)) !== null) {
                    foundTool = true;
                    const toolName = match[1];
                    const argName = match[2];
                    const argValue = match[3].trim();
                    const args: any = {};
                    
                    if (toolName === 'writeFileContent') {
                        args.filePath = argValue;
                        args.content = codeBlocks[codeBlockIdx] ? codeBlocks[codeBlockIdx].replace(/```\w*\n?/, '').replace(/```$/, '').trim() : '';
                        codeBlockIdx++;
                    } else if (toolName === 'runCommand') {
                        args.command = argValue;
                    } else if (toolName === 'listFiles') {
                        args.pattern = argValue;
                    } else if (toolName === 'readFileContent') {
                        args.filePath = argValue;
                    } else if (toolName === 'searchWeb') {
                        args.query = argValue;
                    } else if (toolName === 'generateImage') {
                        args.prompt = argValue;
                    }
                    
                    const toolOutput = await executeTool(toolName, args, spinner);
                    gpt55Messages.push({
                        role: 'tool',
                        name: toolName,
                        content: JSON.stringify(toolOutput)
                    });
                }

                if (foundTool) {
                    continue;
                } else {
                    await saveSession();
                    return responseMsg.content;
                }
            } else {
                await saveSession();
                return responseMsg.content;
            }
        }
    } catch (error: any) {
        spinner.stop();
        console.error(chalk.red("Proxy bağlantısı başarısız oldu, lütfen daha sonra tekrar deneyin"));
        return null;
    }
}
