import chalk from 'chalk';
import ora from 'ora';
import { continueResearch as tsContinueResearch } from '../core/research.js';
import { printSuccess, printError } from '../errors.js';
import { ensureDirs } from '../core/config.js';

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
  hypothesis: 'Generating hypotheses',
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

  ensureDirs();

  const spinner = ora(chalk.cyan('Resuming session...')).start();

  const progressCallback = (node: string, data: Record<string, unknown>) => {
    spinner.text = chalk.cyan(nodeLabel(node));
  };

  try {
    const result = await tsContinueResearch(sessionId, {
      rounds: parseInt(options.rounds || '1'),
      model: options.model,
    }, progressCallback);

    spinner.succeed(chalk.green('Session continued!'));

    console.log(chalk.gray('  Incremental mode: only fetched new papers since last run'));

    if (result.report) {
      console.log(chalk.cyan('\n  Updated files:'));
      console.log(chalk.gray('    - report.md'));
      console.log(chalk.gray('    - report.json'));
      console.log(chalk.gray('    - report.bib'));
      console.log(chalk.gray('    - report.tex'));
      console.log(chalk.gray('    - report.provenance.md'));
    }
    console.log();
    printSuccess('Report updated successfully');
  } catch (err) {
    spinner.fail(chalk.red('Failed to continue session'));
    const error = err as Error;
    printError('E002', error.message || 'Unknown error');
  }

  setTimeout(() => process.exit(0), 500);
}