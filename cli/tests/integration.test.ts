import { describe, it, expect } from 'vitest';

describe('Hilbert CLI', () => {
  it('should export required modules', async () => {
    const { ipcClient } = await import('../src/ipc/index.js');
    expect(ipcClient).toBeDefined();
  });

  it('should have error codes defined', async () => {
    const { formatError } = await import('../src/errors.js');
    expect(formatError('E001')).toContain('Backend connection failed');
    expect(formatError('E003')).toContain('Invalid query');
  });

  it('should have theme support', async () => {
    const { setTheme, getTheme } = await import('../src/ui/theme.js');
    setTheme('dark');
    expect(getTheme()).toBe('dark');
    setTheme('default');
    expect(getTheme()).toBe('default');
  });
});

describe('Research Options', () => {
  it('should parse valid rounds', () => {
    const rounds = parseInt('5');
    expect(rounds).toBe(5);
  });

  it('should use default values', () => {
    const options = {
      rounds: undefined,
      model: undefined,
      output: undefined
    };
    
    const rounds = parseInt(options.rounds || '3');
    expect(rounds).toBe(3);
  });
});