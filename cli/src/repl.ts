import inquirer from 'inquirer';
import chalk from 'chalk';
import { ipcClient } from './ipc/index.js';
import { printBanner, createHelpPanel } from './ui/index.js';
import { setTheme, getTheme } from './ui/theme.js';

const COMMANDS = [
  { name: '/deepresearch', description: 'Run a thorough research investigation' },
  { name: '/lit', description: 'Write a literature review' },
  { name: '/compare', description: 'Compare multiple approaches' },
  { name: '/review', description: 'Review a paper or report' },
  { name: '/draft', description: 'Draft a research paper' },
  { name: '/watch', description: 'Monitor a topic over time' },
  { name: '/log', description: 'View session history' },
  { name: '/theme', description: 'Set the theme (default, dark, light, mono)' },
  { name: '/help', description: 'Show available commands' },
  { name: '/quit', description: 'Exit Hilbert' },
];

export async function startRepl(): Promise<void> {
  printBanner();

  try {
    await ipcClient.connect();
    console.log(chalk.green('  Connected to backend\n'));
  } catch (err) {
    console.log(chalk.yellow('  Running in offline mode\n'));
  }

  let running = true;

  while (running) {
    const input = await inquirer.prompt([
      {
        type: 'input',
        name: 'command',
        message: chalk.cyan('hilbert>'),
        prefix: '',
      }
    ]);

    const cmd = input.command.trim();

    if (!cmd) continue;

    if (cmd.startsWith('/')) {
      const parts = cmd.split(' ');
      const command = parts[0];
      const args = parts.slice(1);

      switch (command) {
        case '/quit':
        case '/exit':
          running = false;
          console.log(chalk.gray('  Goodbye!'));
          break;
        case '/help':
          showHelp();
          break;
        case '/deepresearch':
          await runDeepResearch(args.join(' '));
          break;
        case '/lit':
          await runLiteratureReview(args.join(' '));
          break;
        case '/compare':
          await runCompare(args.join(' '));
          break;
        case '/review':
          await runReview(args.join(' '));
          break;
        case '/draft':
          await runDraft(args.join(' '));
          break;
        case '/watch':
          await runWatch(args.join(' '));
          break;
        case '/log':
          await runLog(args[0]);
          break;
        case '/theme':
          await runTheme(args[0]);
          break;
        default:
          console.log(chalk.yellow(`  Unknown command: ${command}`));
          console.log(chalk.gray('  Type /help for available commands'));
      }
    } else {
      console.log(chalk.yellow('  Commands must start with /'));
      console.log(chalk.gray('  Type /help for available commands'));
    }
  }

  ipcClient.disconnect();
}

function showHelp(): void {
  console.log(chalk.bold('\n  Available Commands:\n'));
  COMMANDS.forEach(cmd => {
    console.log(`  ${chalk.cyan(cmd.name)} - ${cmd.description}`);
  });
  console.log();
}

async function runDeepResearch(topic: string): Promise<void> {
  if (!topic) {
    console.log(chalk.yellow('  Usage: /deepresearch <topic>'));
    return;
  }

  console.log(chalk.cyan(`\n  Running deep research on: ${topic}`));
  
  try {
    const result = await ipcClient.sendCommand('deepresearch', [topic], {});
    if (result.type === 'response') {
      console.log(chalk.green('  Research complete!'));
    } else if (result.type === 'error') {
      console.log(chalk.red(`  Error: ${result.error}`));
    }
  } catch (err) {
    console.log(chalk.yellow('  (Backend not connected - run hilbert server first)'));
  }
}

async function runLiteratureReview(topic: string): Promise<void> {
  if (!topic) {
    console.log(chalk.yellow('  Usage: /lit <topic>'));
    return;
  }

  console.log(chalk.cyan(`\n  Running literature review on: ${topic}`));
  
  try {
    const result = await ipcClient.sendCommand('lit', [topic], {});
    if (result.type === 'response') {
      console.log(chalk.green('  Literature review complete!'));
    } else if (result.type === 'error') {
      console.log(chalk.red(`  Error: ${result.error}`));
    }
  } catch (err) {
    console.log(chalk.yellow('  (Backend not connected - run hilbert server first)'));
  }
}

async function runCompare(topic: string): Promise<void> {
  if (!topic) {
    console.log(chalk.yellow('  Usage: /compare <topic>'));
    return;
  }

  console.log(chalk.cyan(`\n  Comparing: ${topic}`));
  
  try {
    const result = await ipcClient.sendCommand('compare', [topic], {});
    if (result.type === 'response') {
      console.log(chalk.green('  Comparison complete!'));
    } else if (result.type === 'error') {
      console.log(chalk.red(`  Error: ${result.error}`));
    }
  } catch (err) {
    console.log(chalk.yellow('  (Backend not connected - run hilbert server first)'));
  }
}

async function runReview(artifact: string): Promise<void> {
  if (!artifact) {
    console.log(chalk.yellow('  Usage: /review <artifact>'));
    return;
  }

  console.log(chalk.cyan(`\n  Reviewing: ${artifact}`));
  
  try {
    const result = await ipcClient.sendCommand('review', [artifact], {});
    if (result.type === 'response') {
      console.log(chalk.green('  Review complete!'));
    } else if (result.type === 'error') {
      console.log(chalk.red(`  Error: ${result.error}`));
    }
  } catch (err) {
    console.log(chalk.yellow('  (Backend not connected - run hilbert server first)'));
  }
}

async function runDraft(topic: string): Promise<void> {
  if (!topic) {
    console.log(chalk.yellow('  Usage: /draft <topic>'));
    return;
  }

  console.log(chalk.cyan(`\n  Drafting: ${topic}`));
  
  try {
    const result = await ipcClient.sendCommand('draft', [topic], {});
    if (result.type === 'response') {
      console.log(chalk.green('  Draft complete!'));
    } else if (result.type === 'error') {
      console.log(chalk.red(`  Error: ${result.error}`));
    }
  } catch (err) {
    console.log(chalk.yellow('  (Backend not connected - run hilbert server first)'));
  }
}

async function runWatch(topic: string): Promise<void> {
  if (!topic) {
    console.log(chalk.yellow('  Usage: /watch <topic>'));
    return;
  }

  console.log(chalk.cyan(`\n  Watch functionality for: ${topic}`));
  console.log(chalk.gray('  (Coming soon)'));
}

async function runLog(sessionId?: string): Promise<void> {
  console.log(chalk.cyan('\n  Retrieving logs...'));
  
  try {
    const result = await ipcClient.sendCommand('log', sessionId ? [sessionId] : [], {});
    if (result.type === 'response') {
      const logs = result.result as Array<{timestamp: string; action: string; details: string}>;
      if (logs && logs.length > 0) {
        logs.forEach(entry => {
          console.log(chalk.gray(`  [${entry.timestamp}] ${entry.action}`));
        });
      } else {
        console.log(chalk.gray('  No log entries found'));
      }
    } else if (result.type === 'error') {
      console.log(chalk.red(`  Error: ${result.error}`));
    }
  } catch (err) {
    console.log(chalk.yellow('  (Backend not connected - run hilbert server first)'));
  }
}

async function runTheme(themeName?: string): Promise<void> {
  if (!themeName) {
    console.log(chalk.cyan(`\n  Current theme: ${getTheme()}`));
    console.log(chalk.gray('  Available: default, dark, light, mono'));
    return;
  }

  if (setTheme(themeName)) {
    console.log(chalk.green(`\n  Theme set to: ${themeName}`));
  } else {
    console.log(chalk.red(`\n  Unknown theme: ${themeName}`));
    console.log(chalk.gray('  Available: default, dark, light, mono'));
  }
}