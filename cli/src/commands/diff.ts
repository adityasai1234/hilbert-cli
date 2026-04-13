import chalk from 'chalk';
import { ipcClient } from '../ipc/index.js';
import { printError } from '../errors.js';

export interface DiffOptions {
  verbose?: boolean;
}

export async function runDiff(
  sessionA: string,
  sessionB: string,
  _options: DiffOptions
): Promise<void> {
  if (!sessionA || !sessionB) {
    printError('E003', 'Two session IDs required');
    console.log(chalk.gray('  Usage: hilbert diff <session-a> <session-b>'));
    console.log(chalk.gray('  Run: hilbert sessions to see available IDs'));
    return;
  }

  console.log(chalk.cyan(`\n  Comparing sessions:\n    A: ${sessionA}\n    B: ${sessionB}\n`));

  try {
    await ipcClient.connect();

    const result = await ipcClient.sendCommand('diff', [sessionA, sessionB], {});

    if (result.type === 'response') {
      const diff = result.result as {
        papers_only_a: number;
        papers_only_b: number;
        papers_shared: number;
        findings_a: number;
        findings_b: number;
        findings_similarity: number;
      };

      console.log(chalk.bold('  Papers:'));
      console.log(`    ${chalk.green('Shared:')}   ${diff.papers_shared}`);
      console.log(`    ${chalk.cyan('Only in A:')} ${diff.papers_only_a}`);
      console.log(`    ${chalk.cyan('Only in B:')} ${diff.papers_only_b}`);

      console.log(chalk.bold('\n  Findings:'));
      console.log(`    ${chalk.cyan('Session A:')} ${diff.findings_a}`);
      console.log(`    ${chalk.cyan('Session B:')} ${diff.findings_b}`);

      const simPercent = Math.round(diff.findings_similarity * 100);
      console.log(chalk.bold('\n  Semantic Similarity:'));
      console.log(`    ${simPercent}%`);

      if (diff.findings_similarity > 0.8) {
        console.log(chalk.green('    → Highly similar (likely same topic)'));
      } else if (diff.findings_similarity > 0.5) {
        console.log(chalk.yellow('    → Moderately similar (related topics)'));
      } else {
        console.log(chalk.gray('    → Low similarity (different topics)'));
      }

      console.log();
    } else if (result.type === 'error') {
      printError('E002', result.error || 'Diff failed');
    }
  } catch (err) {
    printError('E001', 'Failed to connect to backend');
  }

  ipcClient.disconnect();
  setTimeout(() => process.exit(0), 500);
}