import chalk from 'chalk';
import ora from 'ora';
import { runResearch as tsRunResearch } from '../core/research.js';
import { printSuccess, printError } from '../errors.js';
import { ensureDirs } from '../core/config.js';

export interface ResearchOptions {
  rounds?: string;
  model?: string;
  output?: string;
  subQuestions?: string;
  topK?: string;
  confidence?: string;
}

const NODE_LABELS: Record<string, string> = {
  planner:   'Planning research dimensions',
  search:    'Searching papers',
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

function nodeDetail(event: Record<string, unknown>): string {
  const parts: string[] = [];
  if (event.round !== undefined) parts.push(`round ${event.round}`);
  if (event.papers !== undefined) parts.push(`${event.papers} papers`);
  if (event.findings !== undefined) parts.push(`${event.findings} findings`);
  return parts.length ? chalk.gray(` (${parts.join(', ')})`) : '';
}

export async function runResearch(
  topic: string,
  options: ResearchOptions
): Promise<void> {
  if (!topic || topic.trim().length === 0) {
    printError('E003', 'No research topic provided');
    console.log(chalk.gray('  Usage: hilbert "quantum computing"'));
    console.log(chalk.gray('  Or: hilbert research "quantum computing"'));
    return;
  }

  console.log(chalk.cyan(`\n  Research topic: ${topic}\n`));

  ensureDirs();

  const spinner = ora(chalk.cyan('Planning...')).start();

  const progressCallback = (node: string, data: Record<string, unknown>) => {
    spinner.text = chalk.cyan(nodeLabel(node)) + nodeDetail(data);
  };

  try {
    const result = await tsRunResearch(topic, {
      rounds: parseInt(options.rounds || '3'),
      model: options.model,
      output: options.output,
      subQuestions: parseInt(options.subQuestions || '4'),
      topK: parseInt(options.topK || '20'),
      confidence: parseFloat(options.confidence || '0.75'),
    }, progressCallback);

    spinner.succeed(chalk.green('Research complete!'));

    if (result.report) {
      console.log(chalk.cyan('\n  Generated files:'));
      console.log(chalk.gray('    - report.md'));
      console.log(chalk.gray('    - report.json'));
      console.log(chalk.gray('    - report.bib'));
      console.log(chalk.gray('    - report.tex'));
      console.log(chalk.gray('    - report.provenance.md'));
    }
    console.log();
    printSuccess('Report generated successfully');
  } catch (err) {
    spinner.fail(chalk.red('Research failed'));
    const error = err as Error;
    printError('E002', error.message || 'Unknown error');
  }

  setTimeout(() => process.exit(0), 500);
}