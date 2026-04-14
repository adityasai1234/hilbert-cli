import chalk from 'chalk';
import { execSync } from 'child_process';
import { getSettings } from '../core/config.js';

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

function checkNode(): CheckResult {
  try {
    const version = execSync('node --version', { encoding: 'utf8' }).trim();
    const major = parseInt(version.replace('v', '').split('.')[0]);
    if (major >= 18) {
      return { name: 'Node.js', status: 'pass', message: `v${version}` };
    }
    return { name: 'Node.js', status: 'warn', message: `v${version} (needs 18+)` };
  } catch {
    return { name: 'Node.js', status: 'fail', message: 'Not installed' };
  }
}

function checkNpm(): CheckResult {
  try {
    execSync('npm --version', { encoding: 'utf8' });
    return { name: 'npm', status: 'pass', message: 'Available' };
  } catch {
    return { name: 'npm', status: 'fail', message: 'Not installed' };
  }
}

function checkBuild(): CheckResult {
  try {
    execSync('npm run build', { cwd: './cli', encoding: 'utf8' });
    return { name: 'TypeScript Build', status: 'pass', message: 'Compiles successfully' };
  } catch {
    return { name: 'TypeScript Build', status: 'fail', message: 'Build failed - run cd cli && npm run build' };
  }
}

function checkApiKey(): CheckResult {
  const settings = getSettings();
  const hasOpenAI = !!settings.openaiApiKey;
  const hasAnthropic = !!settings.anthropicApiKey;
  const hasGoogle = !!settings.googleApiKey;
  const hasAzure = !!settings.azureApiKey;

  if (hasOpenAI || hasAnthropic || hasGoogle || hasAzure) {
    const providers = [];
    if (hasOpenAI) providers.push('OpenAI');
    if (hasAnthropic) providers.push('Anthropic');
    if (hasGoogle) providers.push('Google');
    if (hasAzure) providers.push('Azure');
    return { name: 'API Key', status: 'pass', message: `Found: ${providers.join(', ')}` };
  }
  return { name: 'API Key', status: 'warn', message: 'Not set - set OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, or AZURE_API_KEY' };
}

function checkDb(): CheckResult {
  try {
    const { getDb } = require('../core/persistence/schema.js');
    const db = getDb();
    db.prepare('SELECT 1').get();
    return { name: 'SQLite', status: 'pass', message: 'Database accessible' };
  } catch {
    return { name: 'SQLite', status: 'warn', message: 'Database not found - will be created on first run' };
  }
}

export async function runDoctor(): Promise<void> {
  console.log(chalk.bold.cyan('\n  Hilbert Doctor\n'));
  console.log(chalk.gray('  Checking installation...\n'));

  const checks = [
    checkNode(),
    checkNpm(),
    checkBuild(),
    checkApiKey(),
    checkDb()
  ];

  checks.forEach(check => {
    const icon = check.status === 'pass' ? chalk.green('✓') : 
                 check.status === 'warn' ? chalk.yellow('⚠') : 
                 chalk.red('✗');
    const nameColor = check.status === 'pass' ? chalk.green :
                      check.status === 'warn' ? chalk.yellow :
                      chalk.red;
    console.log(`  ${icon} ${nameColor(check.name.padEnd(20))} ${chalk.gray(check.message)}`);
  });

  const passCount = checks.filter(c => c.status === 'pass').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;

  console.log(chalk.gray(`\n  Results: ${chalk.green(passCount)} pass, ${chalk.yellow(warnCount)} warn, ${chalk.red(failCount)} fail\n`));

  if (failCount > 0) {
    console.log(chalk.yellow('  Run "cd cli && npm install && npm run build" to fix issues.\n'));
  }
}