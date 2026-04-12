import chalk from 'chalk';
import ora from 'ora';
import { ipcClient } from '../ipc/index.js';

export interface ReplicateOptions {
  model?: string;
  output?: string;
}

export async function runReplicate(
  paper: string,
  options: ReplicateOptions
): Promise<void> {
  console.log(chalk.cyan(`\n  Planning replication for: ${paper}\n`));

  const spinner = ora(chalk.cyan('Analyzing paper...')).start();

  try {
    await ipcClient.connect();

    spinner.text = chalk.cyan('Generating replication plan...');

    const result = await ipcClient.sendCommand('replicate', [paper], {
      model: options.model,
      output: options.output
    });

    if (result.type === 'response') {
      spinner.succeed(chalk.green('Replication plan created!'));

      const files = result.result as { files?: string[] };
      if (files?.files) {
        console.log(chalk.cyan('\n  Generated files:'));
        files.files.forEach(file => {
          console.log(chalk.gray(`    - ${file}`));
        });
      }
    } else if (result.type === 'error') {
      spinner.fail(chalk.red('Replication failed'));
      console.error(chalk.red(`  ${result.error}`));
    }
  } catch (err) {
    spinner.fail(chalk.red('Failed to start replication'));
    console.error(chalk.red(`  ${err}`));
  }

  ipcClient.disconnect();
  setTimeout(() => process.exit(0), 500);
}