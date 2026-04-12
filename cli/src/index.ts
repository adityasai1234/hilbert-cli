#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('hilbert')
  .description('CLI research agent for academic researchers')
  .version(packageJson.version);

program
  .command('interactive', { isDefault: true })
  .description('Start interactive REPL mode')
  .action(async () => {
    const { startRepl } = await import('./repl');
    await startRepl();
  });

program
  .command('research <topic>')
  .description('Run a research workflow')
  .option('-r, --rounds <number>', 'Number of research rounds', '3')
  .option('-m, --model <model>', 'LLM model to use')
  .option('-o, --output <dir>', 'Output directory')
  .action(async (topic, options) => {
    const { runResearch } = await import('./commands/deepresearch');
    await runResearch(topic, options);
  });

program
  .command('sessions')
  .description('Manage research sessions')
  .action(async () => {
    const { listSessions } = await import('./commands/sessions');
    await listSessions();
  });

program.parse(process.argv);