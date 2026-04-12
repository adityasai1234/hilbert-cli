import chalk from 'chalk';
import { primary, secondary, accent, success, warning, error, muted, getThemeColors, ThemeColors } from './theme.js';

const ASCII_LOGO = `
░██        ░██░██ ░██                               ░██    
░██           ░██ ░██                               ░██    
░████████  ░██░██ ░████████   ░███████  ░██░████ ░████████ 
░██    ░██ ░██░██ ░██    ░██ ░██    ░██ ░███        ░██    
░██    ░██ ░██░██ ░██    ░██ ░█████████ ░██         ░██    
░██    ░██ ░██░██ ░███   ░██ ░██        ░██         ░██    
░██    ░██ ░██░██ ░██░█████   ░███████  ░██         ░██    
`;

export function printBanner(): void {
  console.log(primary(ASCII_LOGO));
  console.log(primary('\n  Hilbert Research Agent'));
  console.log(muted('  Type /help for available commands\n'));
}

export function printCommandList(commands: Array<{name: string; description: string}>): void {
  console.log(primary('\n  Available Commands:\n'));
  commands.forEach(cmd => {
    console.log(`  ${primary(cmd.name)} - ${cmd.description}`);
  });
  console.log();
}

export function printProgress(label: string, value: number, max: number): void {
  const percent = Math.round((value / max) * 20);
  const bar = '█'.repeat(percent) + '░'.repeat(20 - percent);
  console.log(`  ${label}: [${primary(bar)}] ${value}/${max}`);
}

export function printPanel(title: string, content: string[]): void {
  console.log(primary(`\n  ${title}`));
  console.log(primary('  ' + '─'.repeat(40)));
  content.forEach(line => {
    console.log(`  ${line}`);
  });
  console.log();
}

export function printFindings(findings: Array<{text: string; confidence: number}>): void {
  console.log(primary('\n  Recent Findings:\n'));
  findings.forEach(f => {
    const conf = f.confidence >= 0.9 ? success('[high]') : f.confidence >= 0.75 ? warning('[medium]') : error('[low]');
    console.log(`  • ${f.text.slice(0, 60)}... ${conf}`);
  });
  console.log();
}

export function printPapers(papers: Array<{title: string; count: number}>): void {
  console.log(primary('\n  Papers Found:\n'));
  papers.forEach(p => {
    console.log(`  ${secondary(p.title.slice(0, 40))} ${muted(`(${p.count})`)}`);
  });
  console.log();
}

export function printStatus(status: string, node: string, round: number, maxRounds: number): void {
  console.log(primary(`\n  Status: ${status} | Node: ${node} | Round: ${round}/${maxRounds}`));
}

export function printErrorMessage(err: string): void {
  console.log(error(`\n  Error: ${err}`));
}

export function printSuccessMessage(msg: string): void {
  console.log(success(`\n  ✓ ${msg}`));
}

export function printWarningMessage(msg: string): void {
  console.log(warning(`\n  ⚠ ${msg}`));
}

export function clearScreen(): void {
  console.clear();
}

export function printTable(headers: string[], rows: string[][]): void {
  const colWidths = headers.map((h, i) => {
    const maxRow = Math.max(...rows.map(r => (r[i] || '').length));
    return Math.max(h.length, maxRow);
  });

  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join('  ');
  console.log(primary('\n  ' + headerLine));
  console.log(primary('  ' + colWidths.map(w => '─'.repeat(w)).join('  ')));

  rows.forEach(row => {
    const rowLine = row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join('  ');
    console.log(`  ${rowLine}`);
  });
  console.log();
}