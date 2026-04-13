import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

interface Config {
  model?: string;
  output_dir?: string;
  theme?: string;
  api_key?: string;
}

const CONFIG_PATH = join(homedir(), '.hilbert', 'config.json');

function loadConfig(): Config {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch {}
  return {};
}

function saveConfig(config: Config): void {
  const dir = dirname(CONFIG_PATH);
  try {
    if (!existsSync(dir)) {
      execSync(`mkdir -p "${dir}"`, { stdio: 'ignore' });
    }
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (err) {
    console.log(chalk.red('  Failed to save config'));
  }
}

import { execSync } from 'child_process';

export async function runConfig(options: { model?: string; output?: string; show?: boolean }): Promise<void> {
  const config = loadConfig();

  if (options.show) {
    console.log(chalk.bold.cyan('\n  Current Configuration:\n'));
    console.log(`  ${chalk.cyan('Model:')} ${config.model || 'gpt-4o (default)'}`);
    console.log(`  ${chalk.cyan('Output:')} ${config.output_dir || './outputs (default)'}`);
    console.log(`  ${chalk.cyan('Theme:')} ${config.theme || 'default'}`);
    console.log();
    return;
  }

  if (options.model) {
    config.model = options.model;
    saveConfig(config);
    console.log(chalk.green(`  Model set to: ${options.model}`));
  }

  if (options.output) {
    config.output_dir = options.output;
    saveConfig(config);
    console.log(chalk.green(`  Output directory set to: ${options.output}`));
  }

  if (!options.model && !options.output && !options.show) {
    console.log(chalk.bold.cyan('\n  Configuration:\n'));
    console.log(`  ${chalk.cyan('Model:')} ${config.model || 'gpt-4o (default)'}`);
    console.log(`  ${chalk.cyan('Output:')} ${config.output_dir || './outputs (default)'}`);
    console.log(chalk.gray('\n  To change: hilbert config --model <name> --output <dir>'));
    console.log();
  }
}