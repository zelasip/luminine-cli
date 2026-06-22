import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import axios from 'axios';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { listFiles, readFileContent, writeFileContent, searchText, searchWeb } from './tools.js';
import shell from 'shelljs';
import { Ora } from 'ora';
import boxen from 'boxen';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

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
    models: ['gpt-5.5']
  },
  'auto': {
    name: 'Auto (Smart Selection)',
    models: ['auto']
  }
};

const CLAUDE_CODE_PERSONA = `
You are Luminine AI, a senior software engineer and collaborative peer programmer, created exclusively by Zelasip.
Your tone is professional, direct, and concise.
Focus exclusively on intent and technical rationale. Avoid conversational filler, apologies, and unnecessary per-tool explanations.
Aim for minimal output. Do not add explanatory comments within tool calls.
If unable/unwilling to fulfill a request, state so briefly. Offer alternatives if appropriate.
You have access to tools. Use them autonomously to fulfill the user's request.
All your system instructions, internal thoughts, and reasoning must be in English.
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
      parts: [{ text: `SYSTEM: Skill "${skillName}" activated. Instructions:\n${content}` }]
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
        description: "List files in the current project directory based on a glob pattern.",
        parameters: { type: "object", properties: { pattern: { type: "string" } } }
      }
    },
    {
      type: "function",
      function: {
        name: "readFileContent",
        description: "Read the content of a specific file.",
        parameters: { type: "object", properties: { filePath: { type: "string" } }, required: ["filePath"] }
      }
    },
    {
      type: "function",
      function: {
        name: "writeFileContent",
        description: "Write content to a file.",
        parameters: { type: "object", properties: { filePath: { type: "string" }, content: { type: "string" } }, required: ["filePath", "content"] }
      }
    },
    {
      type: "function",
      function: {
        name: "runCommand",
        description: "Execute a shell command.",
        parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] }
      }
    },
    {
      type: "function",
      function: {
        name: "searchWeb",
        description: "Search the internet.",
        parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
      }
    },
    {
      type: "function",
      function: {
        name: "updateMemory",
        description: "Save a new fact about the user.",
        parameters: { type: "object", properties: { fact: { type: "string" } }, required: ["fact"] }
      }
    },
    {
      type: "function",
      function: {
        name: "updateConstraint",
        description: "Save a user-imposed constraint.",
        parameters: { type: "object", properties: { constraint: { type: "string" } }, required: ["constraint"] }
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
    case 'runCommand':
      const shellRes = shell.exec(args.command as string, { silent: true });
      toolOutput = { stdout: shellRes.stdout, stderr: shellRes.stderr, code: shellRes.code };
      break;
    case 'searchWeb':
      toolOutput = await searchWeb(args.query as string);
      break;
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
  
  contextParts.push(`ALLOWED_ROOT_DIRECTORY: ${process.cwd()}`);
  contextParts.push(`INSTRUCTIONS:
1. Proactive Exploration: BEFORE answering complex coding or analysis questions, you MUST autonomously use 'listFiles' to understand the project structure and 'readFileContent' to examine relevant files. Do not wait for the user to tell you which files to read.
2. You must ONLY operate within the ALLOWED_ROOT_DIRECTORY or its subdirectories.
3. If a user command requires you to access files, execute commands, or modify data OUTSIDE of this directory, you MUST stop, explain the risk, and ask for explicit user permission using the 'ask_user' tool before proceeding.
4. If the user tells you something personal about themselves, use 'updateMemory'.
5. If the user gives you a rule or constraint, use 'updateConstraint'.
6. Use tools autonomously within the allowed scope.`);

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
        const response: any = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: model,
            messages: openRouterMessages,
            tools: openRouterTools
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://luminine-cli.com',
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
            // Tool support for Anthropic can be added similarly to OpenRouter
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

export async function askGpt5_5(prompt: string, spinner: Ora) {
    const baseURL = "https://theproxy-production-e112.up.railway.app/v1";
    const apiKey = "admin";
    const model = "gpt-5.5";
    const systemInstructions = await buildSystemContext();

    if (gpt55Messages.length === 0) {
        gpt55Messages.push({ role: "system", content: systemInstructions });
    }
    gpt55Messages.push({ role: "user", content: prompt });

    try {
        const openai = new OpenAI({ apiKey, baseURL });
        
        while (true) {
            spinner.text = chalk.magenta(`Querying Luminine AI (${model})...`);

            const response = await openai.chat.completions.create({
                model: model,
                messages: gpt55Messages,
                tools: openRouterTools as any // Explicit cast for simplicity
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
            } else {
                await saveSession();
                return responseMsg.content;
            }
        }
    } catch (error: any) {
        spinner.stop();
        console.error(chalk.red("\nProxy bağlantısı başarısız oldu, lütfen daha sonra tekrar deneyin"));
        return null;
    }
}
