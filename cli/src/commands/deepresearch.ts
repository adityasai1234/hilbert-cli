import chalk from 'chalk';
import ora from 'ora';
import { ipcClient } from '../ipc/index.js';

export interface ResearchOptions {
  rounds?: string;
  model?: string;
  output?: string;
  subQuestions?: string;
  topK?: string;
  confidence?: string;
}

export async function runResearch(
  topic: string,
  options: ResearchOptions
): Promise<void> {
  console.log(chalk.cyan(`\n  Research topic: ${topic}\n`));

  const spinner = ora(chalk.cyan('Starting research...')).start();

  try {
    await ipcClient.connect();

    spinner.text = chalk.cyan('Running research workflow...');

    const result = await ipcClient.sendCommand('deepresearch', [topic], {
      rounds: parseInt(options.rounds || '3'),
      model: options.model,
      output: options.output,
      subQuestions: parseInt(options.subQuestions || '4'),
      topK: parseInt(options.topK || '20'),
      confidence: parseFloat(options.confidence || '0.75')
    });

    if (result.type === 'response') {
      spinner.succeed(chalk.green('Research complete!'));

      const res = result.result as { files?: string[]; report_id?: string };
      if (res?.files) {
        console.log(chalk.cyan('\n  Generated files:'));
        res.files.forEach(file => {
          console.log(chalk.gray(`    - ${file}`));
        });
      }
      console.log();
    } else if (result.type === 'error') {
      spinner.fail(chalk.red('Research failed'));
      console.error(chalk.red(`  ${result.error}`));
      console.log();
    }
  } catch (err) {
    spinner.fail(chalk.red('Failed to start research'));
    console.error(chalk.red(`  ${err}`));
    console.log();
  }

  ipcClient.disconnect();
  setTimeout(() => process.exit(0), 500);
}