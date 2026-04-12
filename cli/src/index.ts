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
  .option('-r, --rounds <number>', 'Number of research rounds', '3')
  .option('-m, --model <model>', 'LLM model to use')
  .option('-o, --output <dir>', 'Output directory')
  .option('-s, --sub-questions <number>', 'Number of parallel sub-questions', '4')
  .option('-k, --top-k <number>', 'Papers to retain after merger', '20')
  .option('-c, --confidence <number>', 'Minimum confidence threshold', '0.75');

program
  .command('interactive', { isDefault: false })
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
    await runResearch(topic, { ...program.opts(), ...options });
  });

program
  .command('sessions')
  .description('Manage research sessions')
  .action(async () => {
    const { listSessions } = await import('./commands/sessions');
    await listSessions();
  });

program
  .command('setup')
  .description('First-time setup and configuration')
  .action(async () => {
    const { runSetup } = await import('./commands/setup');
    await runSetup();
  });

program
  .command('doctor')
  .description('Check installation and configuration')
  .action(async () => {
    const { runDoctor } = await import('./commands/doctor');
    await runDoctor();
  });

program
  .command('config')
  .description('Manage configuration')
  .option('-m, --model <model>', 'Set default model')
  .option('-o, --output <dir>', 'Set output directory')
  .option('--show', 'Show current configuration')
  .action(async (options) => {
    const { runConfig } = await import('./commands/config');
    await runConfig(options);
  });

program
  .command('replicate <paper>')
  .description('Plan and execute paper replication')
  .option('-m, --model <model>', 'LLM model to use')
  .action(async (paper, options) => {
    const { runReplicate } = await import('./commands/replicate');
    await runReplicate(paper, options);
  });

program
  .command('audit <item>')
  .description('Audit paper claims against code')
  .option('-m, --model <model>', 'LLM model to use')
  .action(async (item, options) => {
    const { runAudit } = await import('./commands/audit');
    await runAudit(item, options);
  });

program
  .command('jobs')
  .description('List background jobs')
  .action(async () => {
    console.log('  No active jobs');
  });

program
  .argument('[query]', 'Research query (runs in one-shot mode)')
  .action(async (query) => {
    if (query) {
      const { runResearch } = await import('./commands/deepresearch');
      await runResearch(query, program.opts());
    } else {
      const { startRepl } = await import('./repl');
      await startRepl();
    }
  });

program.parse(process.argv);