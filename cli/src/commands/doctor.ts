import chalk from 'chalk';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

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

function checkPython(): CheckResult {
  try {
    const version = execSync('python3 --version', { encoding: 'utf8' }).trim();
    return { name: 'Python', status: 'pass', message: version };
  } catch {
    return { name: 'Python', status: 'fail', message: 'Not installed' };
  }
}

function checkHilbert(): CheckResult {
  try {
    execSync('python3 -c "import hilbert; print(hilbert.__version__)"', { encoding: 'utf8' });
    return { name: 'Hilbert (Python)', status: 'pass', message: 'Installed' };
  } catch {
    return { name: 'Hilbert (Python)', status: 'fail', message: 'Not installed (pip install -e .)' };
  }
}

function checkPip(): CheckResult {
  try {
    execSync('python3 -m pip --version', { encoding: 'utf8' });
    return { name: 'pip', status: 'pass', message: 'Available' };
  } catch {
    return { name: 'pip', status: 'warn', message: 'Not found (use python3 -m pip)' };
  }
}

function checkApiKey(): CheckResult {
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    return { name: 'API Key', status: 'pass', message: 'Found in environment' };
  }
  return { name: 'API Key', status: 'warn', message: 'Not set (set OPENAI_API_KEY or ANTHROPIC_API_KEY)' };
}

export async function runDoctor(): Promise<void> {
  console.log(chalk.bold.cyan('\n  Hilbert Doctor\n'));
  console.log(chalk.gray('  Checking installation...\n'));

  const checks = [
    checkNode(),
    checkPython(),
    checkPip(),
    checkHilbert(),
    checkApiKey()
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
    console.log(chalk.yellow('  Run "hilbert setup" to fix installation issues.\n'));
  }
}