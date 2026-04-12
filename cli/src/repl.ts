import chalk from 'chalk';
import inquirer from 'inquirer';
import { ipcClient } from './ipc/index.js';

const ASCII_LOGO = `
░██        ░██░██ ░██                               ░██    
░██           ░██ ░██                               ░██    
░████████  ░██░██ ░████████   ░███████  ░██░████ ░████████ 
░██    ░██ ░██░██ ░██    ░██ ░██    ░██ ░███        ░██    
░██    ░██ ░██░██ ░██    ░██ ░█████████ ░██         ░██    
░██    ░██ ░██░██ ░███   ░██ ░██        ░██         ░██    
░██    ░██ ░██░██ ░██░█████   ░███████  ░██         ░██    
`;

const COMMANDS = [
  { name: '/deepresearch', description: 'Run a thorough research investigation' },
  { name: '/lit', description: 'Write a literature review' },
  { name: '/compare', description: 'Compare multiple approaches' },
  { name: '/review', description: 'Review a paper or report' },
  { name: '/draft', description: 'Draft a research paper' },
  { name: '/watch', description: 'Monitor a topic over time' },
  { name: '/log', description: 'View session history' },
  { name: '/help', description: 'Show available commands' },
  { name: '/quit', description: 'Exit Hilbert' },
];

export async function startRepl(): Promise<void> {
  console.log(chalk.cyan(ASCII_LOGO));
  console.log(chalk.bold.cyan('\n  Hilbert Research Agent v0.1.0'));
  console.log(chalk.gray('  Type /help for available commands\n'));

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

  console.log(chalk.cyan(`  Starting deep research on: ${topic}`));
  console.log(chalk.gray('  (This would connect to the Python backend)'));
}

async function runLiteratureReview(topic: string): Promise<void> {
  if (!topic) {
    console.log(chalk.yellow('  Usage: /lit <topic>'));
    return;
  }

  console.log(chalk.cyan(`  Starting literature review on: ${topic}`));
  console.log(chalk.gray('  (This would connect to the Python backend)'));
}

async function runCompare(topic: string): Promise<void> {
  if (!topic) {
    console.log(chalk.yellow('  Usage: /compare <topic>'));
    return;
  }

  console.log(chalk.cyan(`  Comparing: ${topic}`));
  console.log(chalk.gray('  (This would connect to the Python backend)'));
}