import { Command } from 'commander';
import chalk from 'chalk';

export interface CLIOptions {
  rounds?: number;
  model?: string;
  output?: string;
  sessionId?: string;
}

export function createCommand(name: string, description: string): Command {
  const cmd = new Command(name);
  cmd.description(description);
  return cmd;
}

export function addGlobalOptions(cmd: Command): Command {
  return cmd
    .option('-v, --verbose', 'Enable verbose output')
    .option('-q, --quiet', 'Suppress output');
}

export function printSuccess(message: string): void {
  console.log(chalk.green('✓') + ' ' + message);
}

export function printError(message: string): void {
  console.error(chalk.red('✗') + ' ' + message);
}

export function printWarning(message: string): void {
  console.log(chalk.yellow('⚠') + ' ' + message);
}

export function printInfo(message: string): void {
  console.log(chalk.cyan('ℹ') + ' ' + message);
}