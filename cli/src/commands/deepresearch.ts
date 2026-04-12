import chalk from 'chalk';
import ora from 'ora';
import { ipcClient } from '../ipc/index.js';

export interface ResearchOptions {
  rounds?: number;
  model?: string;
  output?: string;
  sessionId?: string;
}

export async function runResearch(
  topic: string,
  options: ResearchOptions
): Promise<void> {
  const spinner = ora(chalk.cyan('Starting research...')).start();

  try {
    await ipcClient.connect();

    spinner.text = chalk.cyan('Running research workflow...');

    const result = await ipcClient.sendCommand('deepresearch', [topic], {
      rounds: options.rounds || 3,
      model: options.model,
      output: options.output,
      sessionId: options.sessionId
    });

    if (result.type === 'response') {
      spinner.succeed(chalk.green('Research complete!'));

      const files = result.result as { files?: string[] };
      if (files?.files) {
        console.log(chalk.cyan('\n  Generated files:'));
        files.files.forEach(file => {
          console.log(chalk.gray(`    - ${file}`));
        });
      }
    } else if (result.type === 'error') {
      spinner.fail(chalk.red('Research failed'));
      console.error(chalk.red(`  ${result.error}`));
    }
  } catch (err) {
    spinner.fail(chalk.red('Failed to start research'));
    console.error(chalk.red(`  ${err}`));
  }

  ipcClient.disconnect();
}

export async function runDeepResearchFromRepl(topic: string): Promise<void> {
  console.log(chalk.cyan(`\n  Research topic: ${topic}`));

  const spinner = ora(chalk.cyan('Researching...')).start();

  try {
    const result = await ipcClient.sendCommand('deepresearch', [topic], {});

    if (result.type === 'response') {
      spinner.succeed(chalk.green('Research complete!'));
    }
  } catch (err) {
    spinner.fail(chalk.red('Research failed'));
  }
}