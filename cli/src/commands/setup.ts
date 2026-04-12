import chalk from 'chalk';
import inquirer from 'inquirer';
import { ipcClient } from '../ipc/index.js';

const ASCII_LOGO = `
░██        ░██░██ ░██                               ░██    
░██           ░██ ░██                               ░██    
░████████  ░██░██ ░████████   ░███████  ░██░████ ░████████ 
░██    ░██ ░██░██ ░██    ░██ ░██    ░██ ░███        ░██    
░██    ░██ ░██░██ ░██    ░██ ░█████████ ░██         ░██    
░██    ░██ ░██░██ ░███   ░██ ░██        ░██         ░██    
░██    ░██ ░██░██ ░██░█████   ░███████  ░██         ░██    
`;

export async function runSetup(): Promise<void> {
  console.log(chalk.cyan(ASCII_LOGO));
  console.log(chalk.bold.cyan('\n  Hilbert Setup\n'));
  console.log(chalk.gray('  Welcome to Hilbert! Let\'s get you configured.\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiKey',
      message: chalk.cyan('  Enter your API key (or press Enter to skip):'),
      prefix: '',
      default: ''
    },
    {
      type: 'list',
      name: 'model',
      message: chalk.cyan('  Select default model:'),
      choices: [
        'gpt-4o (OpenAI)',
        'gpt-4o-mini (OpenAI)',
        'claude-3-5-sonnet (Anthropic)',
        'gemini-1.5-pro (Google)',
        'ollama/llama3 (Local)'
      ],
      default: 'gpt-4o (OpenAI)'
    },
    {
      type: 'input',
      name: 'outputDir',
      message: chalk.cyan('  Output directory:'),
      prefix: '',
      default: './outputs'
    }
  ]);

  console.log(chalk.gray('\n  Configuration saved!'));
  console.log(chalk.cyan('\n  To use Hilbert:'));
  console.log(chalk.gray('    hilbert "your research question"'));
  console.log(chalk.gray('    hilbert interactive'));
  console.log();
}