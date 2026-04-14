import chalk from 'chalk';
import { getSessionManager } from '../core/persistence/sessionManager.js';

export interface SessionFilters {
  tag?: string;
  status?: string;
  since?: string;
}

export async function listSessions(filters?: SessionFilters): Promise<void> {
  try {
    const sm = getSessionManager();
    const sessions = sm.listSessions({
      status: filters?.status,
      tags: filters?.tag ? [filters.tag] : undefined,
    });

    if (sessions.length === 0) {
      console.log(chalk.gray('  No sessions found'));
    } else {
      console.log(chalk.bold('\n  Sessions:\n'));
      sessions.forEach(session => {
        const statusColor = session.status === 'done' ? chalk.green : chalk.yellow;
        const tagStr = session.tags?.length ? chalk.gray(` [${session.tags.join(', ')}]`) : '';
        console.log(`  ${chalk.cyan(session.session_id.slice(0, 8))} ${statusColor(session.status)} ${chalk.gray(session.query.slice(0, 40))}${tagStr}`);
      });
      console.log();
    }
  } catch (err) {
    console.log(chalk.red('  Failed to list sessions'));
  }

  setTimeout(() => process.exit(0), 500);
}

export async function showSession(sessionId: string): Promise<void> {
  try {
    const sm = getSessionManager();
    const session = sm.getSession(sessionId);

    if (!session) {
      console.log(chalk.red('  Session not found'));
      setTimeout(() => process.exit(0), 500);
      return;
    }

    console.log(chalk.bold(`\n  Session: ${sessionId}\n`));
    console.log(`  ${chalk.cyan('Query:')} ${session.query}`);
    console.log(`  ${chalk.cyan('Status:')} ${session.status}`);
    console.log(`  ${chalk.cyan('Rounds:')} ${session.max_rounds}`);
    console.log(`  ${chalk.cyan('Current Round:')} ${session.current_round}`);
    console.log();
  } catch (err) {
    console.log(chalk.red('  Failed to show session'));
  }

  setTimeout(() => process.exit(0), 500);
}

export async function clearSession(sessionId: string): Promise<void> {
  try {
    const sm = getSessionManager();
    sm.deleteSession(sessionId);
    console.log(chalk.green('  Session cleared'));
  } catch (err) {
    console.log(chalk.red('  Failed to clear session'));
  }

  setTimeout(() => process.exit(0), 500);
}