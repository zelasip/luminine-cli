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
import stringSimilarity from 'string-similarity';
import { showLogo } from './logo.js';
import { listFiles, readFileContent, writeFileContent, searchText } from './tools.js';
import { 
  askGemini, askOpenRouter, resetHistory, getAvailableSkills, activateSkill, 
  saveSession, loadSession, compressHistory, updateMemory 
} from './llm.js';

marked.setOptions({
  renderer: new TerminalRenderer() as any
});

const program = new Command();

const SLASH_COMMANDS = [
  '/help', '/reset', '/config', '/settings', '/ls', '/cat', '/run', '/exit', '/skills',
  '/new', '/resume', '/compress', '/remember'
];

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
      llmResponse = await askOpenRouter(command, spinner);
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

  if (!SLASH_COMMANDS.includes(cmd.toLowerCase())) {
    const matches = stringSimilarity.findBestMatch(cmd.toLowerCase(), SLASH_COMMANDS);
    if (matches.bestMatch.rating > 0.4) {
      console.log(chalk.yellow(`Unknown command "${cmd}". Did you mean "${matches.bestMatch.target}"?`));
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Run ${matches.bestMatch.target}?`,
        default: true
      }]);
      if (confirm) {
        await handleSlashCommand(`${matches.bestMatch.target} ${args.join(' ')}`);
        return;
      }
    } else {
      console.log(chalk.red(`Unknown slash command: ${cmd}`));
      return;
    }
  }

  switch (cmd.toLowerCase()) {
    case '/new':
      resetHistory();
      console.log(chalk.green('New session started. History cleared.'));
      break;

    case '/resume':
      const successLoad = await loadSession();
      if (successLoad) {
        console.log(chalk.green('Session resumed from disk.'));
      } else {
        console.log(chalk.red('No previous session found.'));
      }
      break;

    case '/compress':
      const spinnerComp = ora().start();
      const successComp = await compressHistory(spinnerComp);
      spinnerComp.stop();
      if (successComp) {
        console.log(chalk.green('History compressed into context summary.'));
      } else {
        console.log(chalk.red('Compression failed (check API key).'));
      }
      break;

    case '/remember':
      const fact = args.join(' ');
      if (!fact) {
        console.log(chalk.red('Usage: /remember <fact>'));
        break;
      }
      await updateMemory(fact);
      console.log(chalk.green('Fact added to persistent memory.'));
      break;

    case '/help':
      console.log(chalk.cyan('\nSlash Commands:'));
      console.log(chalk.white('  /new       - Start a new session (clears history)'));
      console.log(chalk.white('  /resume    - Load the previous session from disk'));
      console.log(chalk.white('  /compress  - Summarize history to save context tokens'));
      console.log(chalk.white('  /remember  - Add a fact to long-term persistent memory'));
      console.log(chalk.white('  /skills    - Manage and activate skills (SKILL.md files)'));
      console.log(chalk.white('  /help      - Show this help message'));
      console.log(chalk.white('  /reset     - Full reset of history'));
      console.log(chalk.white('  /config    - Configure API keys'));
      console.log(chalk.white('  /settings  - Show current settings'));
      console.log(chalk.white('  /ls, /cat  - Manual file tools'));
      console.log(chalk.white('  /run, /exit - Shell/Exit\n'));
      break;

    case '/skills':
      const availableSkills = await getAvailableSkills();
      if (availableSkills.length === 0) {
        console.log(chalk.yellow('No skills found in the "skills" directory.'));
        break;
      }
      const { selectedSkill } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedSkill',
          message: 'Choose a skill to activate:',
          choices: availableSkills,
        }
      ]);
      const success = await activateSkill(selectedSkill);
      if (success) {
        console.log(chalk.green(`Skill "${selectedSkill}" activated! Context injected into agent.`));
      } else {
        console.log(chalk.red(`Failed to activate skill "${selectedSkill}".`));
      }
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
          message: 'What do you want to configure?',
          choices: [
            'GEMINI_API_KEY', 
            'OPENROUTER_API_KEY', 
            'ANTHROPIC_API_KEY', 
            'OPENAI_API_KEY',
            'CUSTOM_API_KEY',
            'CUSTOM_BASE_URL',
            'LUMININE_PROVIDER', 
            'LUMININE_MODEL'
          ],
        },
        {
          type: 'input',
          name: 'key',
          message: 'Enter value:',
        }
      ]);
      await fs.appendFile('.env', `\n${answers.type}=${answers.key}`);
      process.env[answers.type] = answers.key; // Update in current process too
      console.log(chalk.green(`${answers.type} saved to .env`));
      break;

    case '/settings':
      console.log(boxen(
        chalk.white(`Provider: ${process.env.LUMININE_PROVIDER || 'gemini'}\n`) +
        chalk.white(`Model: ${process.env.LUMININE_MODEL || 'default'}\n`) +
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
