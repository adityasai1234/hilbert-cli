import chalk from 'chalk';
import ora from 'ora';
import { ipcClient } from '../ipc/index.js';

export interface CompareOptions {
  rounds?: number;
  model?: string;
  output?: string;
}

export async function runComparison(
  topic: string,
  options: CompareOptions
): Promise<void> {
  const spinner = ora(chalk.cyan('Starting comparison...')).start();

  try {
    await ipcClient.connect();

    spinner.text = chalk.cyan('Running comparison workflow...');

    const result = await ipcClient.sendCommand('compare', [topic], {
      rounds: options.rounds || 3,
      model: options.model,
      output: options.output
    });

    if (result.type === 'response') {
      spinner.succeed(chalk.green('Comparison complete!'));

      const files = result.result as { files?: string[] };
      if (files?.files) {
        console.log(chalk.cyan('\n  Generated files:'));
        files.files.forEach(file => {
          console.log(chalk.gray(`    - ${file}`));
        });
      }
    } else if (result.type === 'error') {
      spinner.fail(chalk.red('Comparison failed'));
      console.error(chalk.red(`  ${result.error}`));
    }
  } catch (err) {
    spinner.fail(chalk.red('Failed to start comparison'));
    console.error(chalk.red(`  ${err}`));
  }

  ipcClient.disconnect();
}

export async function runCompareFromRepl(topic: string): Promise<void> {
  if (!topic) {
    console.log(chalk.yellow('  Usage: /compare <topic>'));
    return;
  }

  console.log(chalk.cyan(`\n  Comparing: ${topic}`));

  const spinner = ora(chalk.cyan('Running comparison...')).start();

  try {
    const result = await ipcClient.sendCommand('compare', [topic], {});

    if (result.type === 'response') {
      spinner.succeed(chalk.green('Comparison complete!'));
    }
  } catch (err) {
    spinner.fail(chalk.red('Comparison failed'));
  }
}