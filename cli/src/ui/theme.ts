import chalk from 'chalk';

export type ChalkFunction = (text: string) => string;

export interface ThemeColors {
  primary: ChalkFunction;
  secondary: ChalkFunction;
  accent: ChalkFunction;
  success: ChalkFunction;
  warning: ChalkFunction;
  error: ChalkFunction;
  info: ChalkFunction;
  muted: ChalkFunction;
}

export const themes: Record<string, ThemeColors> = {
  default: {
    primary: chalk.cyan,
    secondary: chalk.magenta,
    accent: chalk.yellow,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    info: chalk.blue,
    muted: chalk.gray
  },
  dark: {
    primary: chalk.cyan,
    secondary: chalk.magenta,
    accent: chalk.yellow,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    info: chalk.blue,
    muted: chalk.gray
  },
  light: {
    primary: chalk.blue,
    secondary: chalk.magenta,
    accent: chalk.black,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    info: chalk.blue,
    muted: chalk.gray
  },
  mono: {
    primary: (s: string) => s,
    secondary: (s: string) => s,
    accent: (s: string) => s,
    success: (s: string) => s,
    warning: (s: string) => s,
    error: (s: string) => s,
    info: (s: string) => s,
    muted: (s: string) => s
  }
};

let currentTheme = 'default';

export function setTheme(theme: string): boolean {
  if (themes[theme]) {
    currentTheme = theme;
    return true;
  }
  return false;
}

export function getTheme(): string {
  return currentTheme;
}

export function getThemeColors(): ThemeColors {
  return themes[currentTheme];
}

export function primary(text: string): string {
  return themes[currentTheme].primary(text);
}

export function secondary(text: string): string {
  return themes[currentTheme].secondary(text);
}

export function accent(text: string): string {
  return themes[currentTheme].accent(text);
}

export function success(text: string): string {
  return themes[currentTheme].success(text);
}

export function warning(text: string): string {
  return themes[currentTheme].warning(text);
}

export function error(text: string): string {
  return themes[currentTheme].error(text);
}

export function info(text: string): string {
  return themes[currentTheme].info(text);
}

export function muted(text: string): string {
  return themes[currentTheme].muted(text);
}