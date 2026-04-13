import chalk from 'chalk';

export interface ErrorContext {
  code: string;
  message: string;
  suggestion?: string;
  details?: string;
}

const ERRORS = {
  'E001': {
    message: 'Backend connection failed',
    suggestion: 'Make sure Python is installed and Hilbert is set up. Run "hilbert doctor" to check.',
  },
  'E002': {
    message: 'Research failed',
    suggestion: 'Check your API key is set. Run "hilbert doctor" to verify configuration.',
  },
  'E003': {
    message: 'Invalid query',
    suggestion: 'Provide a research topic. Usage: hilbert "quantum computing"',
  },
  'E004': {
    message: 'Model not found',
    suggestion: 'Available models: gpt-4o, gpt-4o-mini, claude-3-5-sonnet, gemini-1.5-pro',
  },
  'E005': {
    message: 'API key not set',
    suggestion: 'Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.',
  },
  'E006': {
    message: 'Session not found',
    suggestion: 'Run "hilbert sessions" to see available sessions.',
  },
  'E007': {
    message: 'Output directory not writable',
    suggestion: 'Check permissions or specify a different output directory with --output.',
  },
  'E008': {
    message: 'Network error',
    suggestion: 'Check your internet connection and try again.',
  },
  'E009': {
    message: 'Rate limited',
    suggestion: 'Wait a moment and try again, or use a different model.',
  },
  'E010': {
    message: 'Timeout',
    suggestion: 'The request took too long. Try increasing rounds or using a faster model.',
  },
};

export function formatError(code: string, details?: string): string {
  const error = ERRORS[code as keyof typeof ERRORS];
  
  if (!error) {
    return chalk.red(`  Error: ${details || 'Unknown error'}`);
  }

  let output = chalk.red(`  ✗ ${error.message}`);
  
  if (details) {
    output += chalk.gray(`\n    Details: ${details}`);
  }
  
  if (error.suggestion) {
    output += chalk.cyan(`\n    Hint: ${error.suggestion}`);
  }
  
  return output;
}

export function printError(code: string, details?: string): void {
  console.log(formatError(code, details));
}

export function printSuccess(message: string): void {
  console.log(chalk.green(`  ✓ ${message}`));
}

export function printWarning(message: string): void {
  console.log(chalk.yellow(`  ⚠ ${message}`));
}

export function printInfo(message: string): void {
  console.log(chalk.cyan(`  ℹ ${message}`));
}

export function handleError(err: unknown): void {
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    
    if (message.includes('connect') || message.includes('connection')) {
      printError('E001', err.message);
    } else if (message.includes('api key') || message.includes('unauthorized')) {
      printError('E005', err.message);
    } else if (message.includes('timeout')) {
      printError('E010', err.message);
    } else if (message.includes('not found') || message.includes('404')) {
      printError('E006', err.message);
    } else {
      printError('E000', err.message);
    }
  } else {
    printError('E000', String(err));
  }
}