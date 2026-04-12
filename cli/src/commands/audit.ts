import chalk from 'chalk';
import ora from 'ora';
import { ipcClient } from '../ipc/index.js';

export interface AuditOptions {
  model?: string;
}

export async function runAudit(
  item: string,
  options: AuditOptions
): Promise<void> {
  console.log(chalk.cyan(`\n  Auditing: ${item}\n`));

  const spinner = ora(chalk.cyan('Gathering evidence...')).start();

  try {
    await ipcClient.connect();

    spinner.text = chalk.cyan('Comparing claims to code...');

    const result = await ipcClient.sendCommand('audit', [item], {
      model: options.model
    });

    if (result.type === 'response') {
      spinner.succeed(chalk.green('Audit complete!'));

      const files = result.result as { files?: string[] };
      if (files?.files) {
        console.log(chalk.cyan('\n  Generated files:'));
        files.files.forEach(file => {
          console.log(chalk.gray(`    - ${file}`));
        });
      }
    } else if (result.type === 'error') {
      spinner.fail(chalk.red('Audit failed'));
      console.error(chalk.red(`  ${result.error}`));
    }
  } catch (err) {
    spinner.fail(chalk.red('Failed to start audit'));
    console.error(chalk.red(`  ${err}`));
  }

  ipcClient.disconnect();
  setTimeout(() => process.exit(0), 500);
}