import chalk from 'chalk';
import ora from 'ora';
import { ipcClient } from '../ipc/index.js';

export interface ReviewOptions {
  model?: string;
  output?: string;
}

export async function runReview(
  artifact: string,
  options: ReviewOptions
): Promise<void> {
  const spinner = ora(chalk.cyan('Starting peer review...')).start();

  try {
    await ipcClient.connect();

    spinner.text = chalk.cyan('Running peer review...');

    const result = await ipcClient.sendCommand('review', [artifact], {
      model: options.model,
      output: options.output
    });

    if (result.type === 'response') {
      spinner.succeed(chalk.green('Peer review complete!'));

      const files = result.result as { files?: string[] };
      if (files?.files) {
        console.log(chalk.cyan('\n  Generated files:'));
        files.files.forEach(file => {
          console.log(chalk.gray(`    - ${file}`));
        });
      }
    } else if (result.type === 'error') {
      spinner.fail(chalk.red('Peer review failed'));
      console.error(chalk.red(`  ${result.error}`));
    }
  } catch (err) {
    spinner.fail(chalk.red('Failed to start peer review'));
    console.error(chalk.red(`  ${err}`));
  }

  ipcClient.disconnect();
}

export async function runReviewFromRepl(artifact: string): Promise<void> {
  if (!artifact) {
    console.log(chalk.yellow('  Usage: /review <artifact>'));
    return;
  }

  console.log(chalk.cyan(`\n  Reviewing: ${artifact}`));

  const spinner = ora(chalk.cyan('Running review...')).start();

  try {
    const result = await ipcClient.sendCommand('review', [artifact], {});

    if (result.type === 'response') {
      spinner.succeed(chalk.green('Review complete!'));
    }
  } catch (err) {
    spinner.fail(chalk.red('Review failed'));
  }
}