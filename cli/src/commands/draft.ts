import chalk from 'chalk';
import ora from 'ora';
import { ipcClient } from '../ipc/index.js';

export interface DraftOptions {
  model?: string;
  output?: string;
}

export async function runDraft(
  topic: string,
  options: DraftOptions
): Promise<void> {
  const spinner = ora(chalk.cyan('Starting draft...')).start();

  try {
    await ipcClient.connect();

    spinner.text = chalk.cyan('Generating draft...');

    const result = await ipcClient.sendCommand('draft', [topic], {
      model: options.model,
      output: options.output
    });

    if (result.type === 'response') {
      spinner.succeed(chalk.green('Draft complete!'));

      const files = result.result as { files?: string[] };
      if (files?.files) {
        console.log(chalk.cyan('\n  Generated files:'));
        files.files.forEach(file => {
          console.log(chalk.gray(`    - ${file}`));
        });
      }
    } else if (result.type === 'error') {
      spinner.fail(chalk.red('Draft failed'));
      console.error(chalk.red(`  ${result.error}`));
    }
  } catch (err) {
    spinner.fail(chalk.red('Failed to start draft'));
    console.error(chalk.red(`  ${err}`));
  }

  ipcClient.disconnect();
}

export async function runDraftFromRepl(topic: string): Promise<void> {
  if (!topic) {
    console.log(chalk.yellow('  Usage: /draft <topic>'));
    return;
  }

  console.log(chalk.cyan(`\n  Drafting: ${topic}`));

  const spinner = ora(chalk.cyan('Generating draft...')).start();

  try {
    const result = await ipcClient.sendCommand('draft', [topic], {});

    if (result.type === 'response') {
      spinner.succeed(chalk.green('Draft complete!'));
    }
  } catch (err) {
    spinner.fail(chalk.red('Draft failed'));
  }
}