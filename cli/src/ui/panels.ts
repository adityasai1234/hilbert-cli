import chalk from 'chalk';
import { primary, secondary, accent, success, warning, error, muted } from './theme.js';

export interface PanelConfig {
  title: string;
  width?: number;
  border?: boolean;
}

export function createPanel(config: PanelConfig, lines: string[]): string {
  const width = config.width || 60;
  const border = config.border !== false;
  
  let output = '\n';
  
  if (border) {
    output += primary('┌' + '─'.repeat(width - 2) + '┐\n');
    output += primary('│') + primary(config.title.padStart((width - 2 + config.title.length) / 2)) + primary('│'.padStart(width - 1 - Math.floor((width - 2 - config.title.length) / 2)) + '\n');
    output += primary('├' + '─'.repeat(width - 2) + '┤\n');
  } else {
    output += primary(`  ${config.title}\n`);
    output += primary('  ' + '─'.repeat(width - 4) + '\n');
  }
  
  lines.forEach(line => {
    const padding = border ? width - line.length - 4 : 0;
    output += primary('│ ') + line + ' '.repeat(Math.max(0, padding)) + (border ? ' │\n' : '\n');
  });
  
  if (border) {
    output += primary('└' + '─'.repeat(width - 2) + '┘\n');
  }
  
  return output;
}

export function createQueryPanel(query: string): string {
  return createPanel(
    { title: ' Query ', width: 50, border: false },
    [query]
  );
}

export function createProgressPanel(
  round: number,
  maxRounds: number,
  papers: number,
  findings: number,
  status: string
): string {
  const progress = '█'.repeat(Math.round((round / maxRounds) * 10)) + '░'.repeat(10 - Math.round((round / maxRounds) * 10));
  
  return createPanel(
    { title: ' Progress ', width: 50 },
    [
      `Round: [${primary(progress)}] ${round}/${maxRounds}`,
      `Papers: ${secondary(papers.toString())}`,
      `Findings: ${secondary(findings.toString())}`,
      `Status: ${status === 'done' ? success('done') : warning(status)}`
    ]
  );
}

export function createAgentsPanel(agents: Array<{name: string; status: 'done' | 'running' | 'pending'}>): string {
  const lines = agents.map(a => {
    const icon = a.status === 'done' ? success('☑') : a.status === 'running' ? warning('◐') : muted('☐');
    return `${icon} ${a.name}`;
  });
  
  return createPanel(
    { title: ' Search Agents ', width: 50 },
    lines
  );
}

export function createFindingsPanel(findings: Array<{text: string; confidence: number}>): string {
  const lines = findings.slice(0, 5).map(f => {
    const conf = f.confidence >= 0.9 ? success('[0.9+]') : f.confidence >= 0.75 ? warning(`[${f.confidence.toFixed(2)}]`) : error(`[<${f.confidence.toFixed(2)}]`);
    return `${f.text.slice(0, 35)}... ${conf}`;
  });
  
  return createPanel(
    { title: ' Recent Findings ', width: 50 },
    lines
  );
}

export function createHelpPanel(commands: Array<{name: string; description: string}>): string {
  const lines = commands.map(c => `${primary(c.name.padEnd(15))} ${muted(c.description)}`);
  
  return createPanel(
    { title: ' Commands ', width: 60 },
    lines
  );
}

export function printLayout(
  query: string,
  round: number,
  maxRounds: number,
  papers: number,
  findings: number,
  status: string,
  recentFindings: Array<{text: string; confidence: number}>
): void {
  console.log(createQueryPanel(query));
  console.log(createProgressPanel(round, maxRounds, papers, findings, status));
  console.log(createFindingsPanel(recentFindings));
}