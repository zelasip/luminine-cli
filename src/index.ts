#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import shell from 'shelljs';
import fs from 'fs/promises';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import boxen from 'boxen';
import { showLogo } from './logo.js';
import { listFiles, readFileContent, writeFileContent, searchText } from './tools.js';
import { askGemini, askOpenRouter, resetHistory } from './llm.js';

// Configure marked to use terminal renderer
marked.setOptions({
  renderer: new TerminalRenderer() as any
});

const program = new Command();

program
  .name('luminine')
  .description('A powerful coding CLI like Claude Code')
  .version('1.0.0')
  .arguments('[command...]')
  .action(async (args: string[]) => {
    if (args.length === 0) {
      showLogo();
      await startInteractiveSession();
    } else {
      await handleCommand(args.join(' '));
    }
  });

async function startInteractiveSession() {
  console.log(chalk.green('Interactive session started. Type "/help" for commands.'));
  
  while (true) {
    const { input } = await inquirer.prompt([
      {
        type: 'input',
        name: 'input',
        message: chalk.hex('#8a2be2')('luminine>'),
      }
    ]);

    if (!input) continue;

    const trimmedInput = input.trim();
    if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
      console.log(chalk.yellow('Goodbye!'));
      process.exit(0);
    }

    if (trimmedInput === '') continue;

    await handleCommand(trimmedInput);
  }
}

async function handleCommand(command: string) {
  if (command.startsWith('/')) {
    await handleSlashCommand(command);
    return;
  }

  const spinner = ora(chalk.magenta('Luminine is thinking...')).start();
  const provider = process.env.LUMININE_PROVIDER || 'gemini';
  let llmResponse;

  try {
    if (provider === 'openrouter') {
      spinner.text = 'Querying OpenRouter...';
      llmResponse = await askOpenRouter(command);
    } else {
      llmResponse = await askGemini(command, spinner);
    }

    spinner.stop();
    
    if (llmResponse) {
      console.log(chalk.magenta('\nLuminine:'));
      console.log(marked.parse(llmResponse));
    }
  } catch (error: any) {
    spinner.stop();
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

async function handleSlashCommand(command: string) {
  const [cmd, ...args] = command.split(' ');

  switch (cmd.toLowerCase()) {
    case '/help':
      console.log(chalk.cyan('\nSlash Commands:'));
      console.log(chalk.white('  /help      - Show this help message'));
      console.log(chalk.white('  /reset     - Reset conversation history'));
      console.log(chalk.white('  /config    - Configure API keys'));
      console.log(chalk.white('  /settings  - Show current settings'));
      console.log(chalk.white('  /ls        - List files (manual)'));
      console.log(chalk.white('  /cat       - Read file (manual)'));
      console.log(chalk.white('  /run       - Execute shell command (manual)'));
      console.log(chalk.white('  /exit      - Exit the CLI\n'));
      break;

    case '/reset':
      resetHistory();
      console.log(chalk.yellow('Conversation history has been reset.'));
      break;

    case '/config':
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'type',
          message: 'Which API key do you want to set?',
          choices: ['GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'LUMININE_PROVIDER'],
        },
        {
          type: 'input',
          name: 'key',
          message: 'Enter value:',
        }
      ]);
      await fs.appendFile('.env', `\n${answers.type}=${answers.key}`);
      console.log(chalk.green(`${answers.type} saved to .env`));
      break;

    case '/settings':
      console.log(boxen(
        chalk.white(`Provider: ${process.env.LUMININE_PROVIDER || 'gemini'}\n`) +
        chalk.white(`Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not Set'}\n`) +
        chalk.white(`OpenRouter API: ${process.env.OPENROUTER_API_KEY ? '✅ Set' : '❌ Not Set'}`),
        { title: 'Luminine Settings', padding: 1, borderColor: 'magenta' }
      ));
      break;

    case '/ls':
      const files = await listFiles(args[0] || '**/*');
      console.log(chalk.cyan('Files:'));
      files.forEach(f => console.log(chalk.white(`  ${f}`)));
      break;

    case '/cat':
      if (!args[0]) {
        console.log(chalk.red('Usage: /cat <filename>'));
        break;
      }
      const content = await readFileContent(args[0]);
      if (content !== null) {
        console.log(boxen(content, { title: args[0], borderColor: 'blue', padding: 0.5 }));
      }
      break;

    case '/run':
      const shellCmd = args.join(' ');
      if (!shellCmd) {
        console.log(chalk.red('Usage: /run <command>'));
        break;
      }
      const result = shell.exec(shellCmd, { silent: true });
      console.log(boxen(result.stdout || result.stderr || 'No output', {
        title: shellCmd,
        borderColor: result.code === 0 ? 'green' : 'red'
      }));
      break;

    case '/exit':
      process.exit(0);
      break;

    default:
      console.log(chalk.red(`Unknown slash command: ${cmd}`));
  }
}

program.parse(process.argv);
