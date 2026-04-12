import chalk from 'chalk';
import ora from 'ora';
import { ipcClient } from '../ipc/index.js';

export interface LitOptions {
  rounds?: number;
  model?: string;
  output?: string;
}

export async function runLiteratureReview(
  topic: string,
  options: LitOptions
): Promise<void> {
  const spinner = ora(chalk.cyan('Starting literature review...')).start();

  try {
    await ipcClient.connect();

    spinner.text = chalk.cyan('Running literature review workflow...');

    const result = await ipcClient.sendCommand('lit', [topic], {
      rounds: options.rounds || 3,
      model: options.model,
      output: options.output
    });

    if (result.type === 'response') {
      spinner.succeed(chalk.green('Literature review complete!'));

      const files = result.result as { files?: string[] };
      if (files?.files) {
        console.log(chalk.cyan('\n  Generated files:'));
        files.files.forEach(file => {
          console.log(chalk.gray(`    - ${file}`));
        });
      }
    } else if (result.type === 'error') {
      spinner.fail(chalk.red('Literature review failed'));
      console.error(chalk.red(`  ${result.error}`));
    }
  } catch (err) {
    spinner.fail(chalk.red('Failed to start literature review'));
    console.error(chalk.red(`  ${err}`));
  }

  ipcClient.disconnect();
}

export async function runLitFromRepl(topic: string): Promise<void> {
  if (!topic) {
    console.log(chalk.yellow('  Usage: /lit <topic>'));
    return;
  }

  console.log(chalk.cyan(`\n  Literature review topic: ${topic}`));

  const spinner = ora(chalk.cyan('Reviewing literature...')).start();

  try {
    const result = await ipcClient.sendCommand('lit', [topic], {});

    if (result.type === 'response') {
      spinner.succeed(chalk.green('Literature review complete!'));
    }
  } catch (err) {
    spinner.fail(chalk.red('Literature review failed'));
  }
}