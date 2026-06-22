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
import readline from 'readline';
import gradient from 'gradient-string';
import { showLogo } from './logo.js';
import { listFiles, readFileContent, writeFileContent, searchText } from './tools.js';
import { 
  askGemini, askOpenRouter, askAnthropic, askOpenAI, askCustom, askGpt5_5,
  resetHistory, rewindHistory, getAvailableSkills, activateSkill, 
  saveSession, loadSession, compressHistory, updateMemory, SUPPORTED_MODELS 
} from './llm.js';

marked.setOptions({
  renderer: new TerminalRenderer() as any
});

const program = new Command();

const SLASH_COMMANDS = [
  '/help', '/reset', '/config', '/settings', '/ls', '/cat', '/run', '/exit', '/skills',
  '/new', '/resume', '/compress', '/remember', '/models', '/rewind', '/goal'
];

program
  .name('luminine')
  .description('A powerful coding CLI like Claude Code')
  .version('1.0.0')
  .option('-m, --model <type>', 'Specify the model to use (e.g., gpt-5.5)')
  .arguments('[command...]')
  .action(async (args: string[], options: any) => {
    if (options.model) {
      process.env.LUMININE_MODEL = options.model;
      if (options.model === 'gpt-5.5') {
        process.env.LUMININE_PROVIDER = 'gpt-5.5';
      }
    }
    if (args.length === 0) {
      showLogo();
      await startInteractiveSession();
    } else {
      await handleCommand(args.join(' '));
    }
  });

const setTerminalTitle = (title: string) => {
    process.stdout.write(String.fromCharCode(27) + ']0;' + title + String.fromCharCode(7));
};

async function startInteractiveSession() {
  console.log(chalk.green('Interactive session started. Type "/help" for commands.'));
  
  const statusMessages = [
    'Hobnobbing', 'Smelting', 'Crafting', 'Mining', 'Chop-chopping', 'Smithing', 
    'Enchanting', 'Grinding', 'Looting', 'Folding space', 'Splining reticulated', 
    'Bending spoons', 'Rerouting power', 'Calibrating', 'Defragging', 'Overclocking',
    'Splitting atoms', 'Sequencing DNA', 'Synthesizing', 'Consulting the oracle',
    'Manifesting', 'Brewing'
  ];

  let currentStatus = 'Waiting4U';
  
  const setStatus = (status: string) => {
    currentStatus = status;
    setTerminalTitle(`Luminine CLI | ${currentStatus}`);
  };

  const startAnimation = () => {
    const msg = statusMessages[Math.floor(Math.random() * statusMessages.length)];
    setStatus(msg + '...');
  };

  setStatus('Waiting4U');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('❯ ')
  });

  rl.prompt();

  let isBusy = false;

  rl.on('line', async (line) => {
    if (isBusy) {
      rl.prompt();
      return;
    }
    
    rl.pause();
    isBusy = true;
    
    if (line.length > 500) {
        const lines = line.split('\n').length;
        console.log(chalk.yellow(`\n--- [Pasted ${lines} lines / ${line.length} characters] ---\n`));
    }
    
    const trimmedInput = line.trim();

    if (trimmedInput === '') {
      isBusy = false;
      setStatus('Waiting4U');
      rl.prompt();
      rl.resume();
      return;
    }

    if (trimmedInput.toLowerCase() === '/exit' || trimmedInput.toLowerCase() === '/q') {
      console.log(chalk.yellow('Goodbye!'));
      process.exit(0);
    }

    const animInterval = setInterval(startAnimation, 1000);
    await handleCommand(trimmedInput);
    clearInterval(animInterval);
    
    isBusy = false;
    setStatus('Waiting4U');
    rl.prompt();
    rl.resume();
  });

  rl.on('SIGINT', () => {
    console.log(chalk.yellow('\n(Press "/exit" or "/q" to quit)'));
    rl.prompt();
  });
}

async function handleCommand(command: string) {
  if (command.startsWith('/')) {
    await handleSlashCommand(command);
    return null;
  }

  const spinner = ora(chalk.cyan('Luminine is thinking...')).start();
  const provider = process.env.LUMININE_PROVIDER || 'gemini';
  const model = process.env.LUMININE_MODEL || 'default';
  let llmResponse;

  try {
    if (provider === 'gpt-5.5' || model === 'gpt-5.5') {
      spinner.text = 'Querying Luminine AI (gpt-5.5)...';
      llmResponse = await askGpt5_5(command, spinner);
    } else if (provider === 'openrouter') {
      spinner.text = 'Querying OpenRouter...';
      llmResponse = await askOpenRouter(command, spinner);
    } else if (provider === 'anthropic') {
      spinner.text = 'Querying Anthropic...';
      llmResponse = await askAnthropic(command, spinner);
    } else if (provider === 'openai') {
      spinner.text = 'Querying OpenAI...';
      llmResponse = await askOpenAI(command, spinner);
    } else if (provider === 'custom') {
      spinner.text = 'Querying Custom Provider...';
      llmResponse = await askCustom(command, spinner);
    } else {
      llmResponse = await askGemini(command, spinner);
    }

    spinner.stop();
    
    if (llmResponse) {
      console.log(boxen(
        String(marked.parse(llmResponse)),
        {
          title: chalk.bold.gray(` ${provider.toUpperCase()} `),
          titleAlignment: 'right',
          padding: 0,
          borderColor: 'gray',
          borderStyle: 'single',
          margin: 0
        }
      ));
    }
    return llmResponse;
  } catch (error: any) {
    spinner.stop();
    console.error(boxen(chalk.red(`Error: ${error.message}`), {
        title: chalk.bold.red(' CRITICAL ERROR '),
        padding: 1,
        borderColor: 'red',
        borderStyle: 'double'
    }));
    return null;
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

    case '/rewind':
      const { n } = await inquirer.prompt([{
        type: 'number',
        name: 'n',
        message: 'How many messages to rewind?',
        default: 1
      }]);
      const msg = rewindHistory(n);
      console.log(chalk.green(msg));
      break;

    case '/goal':
      const goal = args.join(' ');
      if (!goal) { console.log(chalk.red('Usage: /goal <task>')); break; }
      console.log(chalk.green(`Goal set: ${goal}. Starting autonomous loop...`));
      
      let goalInProgress = true;
      let prompt = `Goal: ${goal}. Please break this down into sub-tasks and execute them one by one. If you have finished, say "GOAL_FINISHED".`;
      
      while (goalInProgress) {
        const response = await handleCommand(prompt);
        if (response && response.includes('GOAL_FINISHED')) {
          goalInProgress = false;
          console.log(chalk.green('Goal achieved!'));
        } else {
          prompt = "Continue with the next sub-task. If finished, say GOAL_FINISHED.";
        }
      }
      break;

    case '/resume':
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: 'Resume previous session?',
        default: true
      }]);
      if (confirm) {
        const successLoad = await loadSession();
        if (successLoad) {
          console.log(chalk.green('Session resumed.'));
        } else {
          console.log(chalk.red('No session found.'));
        }
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

    case '/models':
      const { provider } = await inquirer.prompt([{
        type: 'list',
        name: 'provider',
        message: 'Select a provider:',
        choices: Object.entries(SUPPORTED_MODELS).map(([key, p]: [string, any]) => ({ name: p.name, value: key }))
      }]);

      const selectedProvider = (SUPPORTED_MODELS as any)[provider];
      const { model } = await inquirer.prompt([{
        type: 'list',
        name: 'model',
        message: `Select a model for ${selectedProvider.name}:`,
        choices: selectedProvider.models
      }]);

      process.env.LUMININE_PROVIDER = provider;
      process.env.LUMININE_MODEL = model;
      
      const envContent = await fs.readFile('.env', 'utf-8').catch(() => '');
      let newEnv = envContent;
      ['LUMININE_PROVIDER', 'LUMININE_MODEL'].forEach(key => {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(newEnv)) {
          newEnv = newEnv.replace(regex, `${key}=${process.env[key as keyof NodeJS.ProcessEnv]}`);
        } else {
          newEnv += `\n${key}=${process.env[key as keyof NodeJS.ProcessEnv]}`;
        }
      });
      await fs.writeFile('.env', newEnv);

      console.log(chalk.green(`Provider set to ${provider}, Model set to ${model}`));
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
      process.env[answers.type] = answers.key;
      console.log(chalk.green(`${answers.type} saved to .env`));
      break;

    case '/settings':
      console.log(boxen(
        chalk.white(`Provider: ${process.env.LUMININE_PROVIDER || 'gemini'}\n`) +
        chalk.white(`Model: ${process.env.LUMININE_MODEL || 'default'}\n`) +
        chalk.white(`Gemini API: ${process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not Set'}\n`) +
        chalk.white(`OpenRouter API: ${process.env.OPENROUTER_API_KEY ? '✅ Set' : '❌ Not Set'}\n`) +
        chalk.white(`Anthropic API: ${process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not Set'}\n`) +
        chalk.white(`OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not Set'}\n`) +
        chalk.white(`Custom API: ${process.env.CUSTOM_API_KEY ? '✅ Set' : '❌ Not Set'}`),
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
