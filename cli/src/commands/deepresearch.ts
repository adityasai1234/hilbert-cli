import chalk from 'chalk';
import ora from 'ora';
import { ipcClient, StreamEvent } from '../ipc/index.js';
import { handleError, printSuccess, printError } from '../errors.js';

export interface ResearchOptions {
  rounds?: string;
  model?: string;
  output?: string;
  subQuestions?: string;
  topK?: string;
  confidence?: string;
}

// Human-readable labels for each pipeline node
const NODE_LABELS: Record<string, string> = {
  planner:   'Planning research dimensions',
  search:    'Searching papers',
  merger:    'Deduplicating & ranking sources',
  synthesis: 'Extracting findings',
  verifier:  'Verifying claims',
  reviewer:  'Reviewing coverage & integrity',
  writer:    'Writing report',
};

function nodeLabel(node: string): string {
  return NODE_LABELS[node] ?? `Running ${node}`;
}

function nodeDetail(event: StreamEvent): string {
  const parts: string[] = [];
  if (event.round !== undefined) parts.push(`round ${event.round}`);
  if (event.papers_found !== undefined) parts.push(`${event.papers_found} papers`);
  if (event.findings !== undefined) parts.push(`${event.findings.length} findings`);
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

  const spinner = ora(chalk.cyan('Connecting...')).start();

  try {
    await ipcClient.connect();

    spinner.text = chalk.cyan('Planning...');

    // Register stream handler before sending the command so no events are missed
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    ipcClient.onStream(msgId, (event: StreamEvent) => {
      const node = event.current_node ?? event.status ?? '';
      if (node) {
        spinner.text = chalk.cyan(nodeLabel(node)) + nodeDetail(event);
      }
    });

    const result = await ipcClient.sendCommand('deepresearch', [topic], {
      rounds: parseInt(options.rounds || '3'),
      model: options.model,
      output: options.output,
      subQuestions: parseInt(options.subQuestions || '4'),
      topK: parseInt(options.topK || '20'),
      confidence: parseFloat(options.confidence || '0.75'),
    }, msgId);

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
      printSuccess('Report generated successfully');
    } else if (result.type === 'error') {
      spinner.fail(chalk.red('Research failed'));
      printError('E002', result.error || 'Unknown error');
    }
  } catch (err) {
    spinner.fail(chalk.red('Failed to start research'));
    handleError(err);
  }

  ipcClient.disconnect();
  setTimeout(() => process.exit(0), 500);
}