import chalk from 'chalk';
import { ipcClient } from '../ipc/index.js';

export async function runLog(sessionId?: string): Promise<void> {
  try {
    await ipcClient.connect();

    const result = await ipcClient.sendCommand('log', sessionId ? [sessionId] : [], {});

    if (result.type === 'response') {
      const logs = result.result as Array<{
        timestamp: string;
        action: string;
        details: string;
      }>;

      if (!logs || logs.length === 0) {
        console.log(chalk.gray('  No log entries found'));
        return;
      }

      console.log(chalk.bold('\n  Session Log:\n'));
      logs.forEach(entry => {
        console.log(chalk.gray(`  [${entry.timestamp}]`) + ` ${entry.action}`);
        if (entry.details) {
          console.log(chalk.gray(`    ${entry.details}`));
        }
      });
      console.log();
    }
  } catch (err) {
    console.log(chalk.red('  Failed to retrieve logs'));
    console.log(chalk.gray('  Make sure the backend is running'));
  }

  ipcClient.disconnect();
}

export async function runLogFromRepl(sessionId?: string): Promise<void> {
  await runLog(sessionId);
}