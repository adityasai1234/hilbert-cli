import chalk from 'chalk';
import ora from 'ora';
import { ipcClient, StreamEvent } from '../ipc/index.js';
import { handleError, printSuccess, printError } from '../errors.js';

export interface ContinueOptions {
  rounds?: string;
  model?: string;
}

const NODE_LABELS: Record<string, string> = {
  planner:   'Planning research dimensions',
  search:    'Searching papers (incremental)',
  merger:    'Deduplicating & ranking sources',
  synthesis: 'Extracting findings',
  verifier:  'Verifying claims',
  reviewer:  'Reviewing coverage & integrity',
  writer:    'Writing report',
};

function nodeLabel(node: string): string {
  return NODE_LABELS[node] ?? `Running ${node}`;
}

export async function runContinue(
  sessionId: string,
  options: ContinueOptions
): Promise<void> {
  if (!sessionId || sessionId.trim().length === 0) {
    printError('E003', 'No session ID provided');
    console.log(chalk.gray('  Usage: hilbert continue session-abc123'));
    console.log(chalk.gray('  Run: hilbert sessions to see available IDs'));
    return;
  }

  console.log(chalk.cyan(`\n  Continuing session: ${sessionId}\n`));

  const spinner = ora(chalk.cyan('Connecting...')).start();

  try {
    await ipcClient.connect();

    spinner.text = chalk.cyan('Resuming session...');

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    ipcClient.onStream(msgId, (event: StreamEvent) => {
      const node = event.current_node ?? event.status ?? '';
      if (node) {
        spinner.text = chalk.cyan(nodeLabel(node));
      }
    });

    const result = await ipcClient.sendCommand('continue', [sessionId], {
      rounds: parseInt(options.rounds || '1'),
      model: options.model,
    }, msgId);

    if (result.type === 'response') {
      const res = result.result as { incremental?: boolean; files?: string[] };
      spinner.succeed(chalk.green('Session continued!'));

      if (res?.incremental) {
        console.log(chalk.gray('  Incremental mode: only fetched new papers since last run'));
      }

      const files = res?.files;
      if (files) {
        console.log(chalk.cyan('\n  Updated files:'));
        files.forEach(file => {
          console.log(chalk.gray(`    - ${file}`));
        });
      }
      console.log();
      printSuccess('Report updated successfully');
    } else if (result.type === 'error') {
      spinner.fail(chalk.red('Failed to continue session'));
      printError('E002', result.error || 'Unknown error');
    }
  } catch (err) {
    spinner.fail(chalk.red('Failed to connect'));
    handleError(err);
  }

  ipcClient.disconnect();
  setTimeout(() => process.exit(0), 500);
}