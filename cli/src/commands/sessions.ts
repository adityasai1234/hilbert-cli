import chalk from 'chalk';
import { ipcClient } from '../ipc/index.js';

export interface SessionFilters {
  tag?: string;
  status?: string;
  since?: string;
}

export async function listSessions(filters?: SessionFilters): Promise<void> {
  try {
    await ipcClient.connect();

    const options: Record<string, string> = {};
    if (filters?.tag) options.tag = filters.tag;
    if (filters?.status) options.status = filters.status;
    if (filters?.since) options.since = filters.since;

    const result = await ipcClient.sendCommand('sessions', ['list'], options);

    if (result.type === 'response') {
      const sessions = result.result as Array<{
        id: string;
        query: string;
        status: string;
        created_at: string;
        tags?: string[];
      }>;

      if (sessions.length === 0) {
        console.log(chalk.gray('  No sessions found'));
      } else {
        console.log(chalk.bold('\n  Sessions:\n'));
        sessions.forEach(session => {
          const statusColor = session.status === 'done' ? chalk.green : chalk.yellow;
          const tagStr = session.tags?.length ? chalk.gray(` [${session.tags.join(', ')}]`) : '';
          console.log(`  ${chalk.cyan(session.id.slice(0, 8))} ${statusColor(session.status)} ${chalk.gray(session.query.slice(0, 40))}${tagStr}`);
        });
        console.log();
      }
    }
  } catch (err) {
    console.log(chalk.red('  Failed to list sessions'));
  }

  ipcClient.disconnect();
  setTimeout(() => process.exit(0), 500);
}

export async function showSession(sessionId: string): Promise<void> {
  try {
    await ipcClient.connect();

    const result = await ipcClient.sendCommand('sessions', ['show', sessionId], {});

    if (result.type === 'response') {
      const session = result.result as {
        query: string;
        status: string;
        rounds: number;
        papers: number;
        findings: number;
      };

      console.log(chalk.bold(`\n  Session: ${sessionId}\n`));
      console.log(`  ${chalk.cyan('Query:')} ${session.query}`);
      console.log(`  ${chalk.cyan('Status:')} ${session.status}`);
      console.log(`  ${chalk.cyan('Rounds:')} ${session.rounds}`);
      console.log(`  ${chalk.cyan('Papers:')} ${session.papers}`);
      console.log(`  ${chalk.cyan('Findings:')} ${session.findings}`);
      console.log();
    }
  } catch (err) {
    console.log(chalk.red('  Failed to show session'));
  }

  ipcClient.disconnect();
}

export async function clearSession(sessionId: string): Promise<void> {
  try {
    await ipcClient.connect();

    const result = await ipcClient.sendCommand('sessions', ['clear', sessionId], {});

    if (result.type === 'response') {
      console.log(chalk.green('  Session cleared'));
    }
  } catch (err) {
    console.log(chalk.red('  Failed to clear session'));
  }

  ipcClient.disconnect();
}