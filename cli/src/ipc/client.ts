import { spawn, ChildProcess } from 'child_process';
import { Readable } from 'stream';
import { createInterface } from 'readline';
import chalk from 'chalk';
import { IPCMessage, parseResponse, StreamEvent } from './protocol.js';

export type MessageHandler = (msg: IPCMessage) => void;

export class IPCClient {
  private process: ChildProcess | null = null;
  private messageHandlers: Map<string, MessageHandler> = new Map();
  private streamHandlers: Map<string, (event: StreamEvent) => void> = new Map();
  private pendingRequests: Map<string, { resolve: (value: IPCMessage) => void; reject: (error: Error) => void }> = new Map();
  private isConnected: boolean = false;
  private readyResolve: ((value: void) => void) | null = null;
  private stderrLines: string[] = [];

  async connect(): Promise<void> {
    if (this.isConnected && this.process) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.readyResolve = resolve;

      this.process = spawn('python3', ['-m', 'hilbert', 'server', 'stdio'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
        detached: false
      });

      const rl = createInterface({
        input: this.process.stdout as Readable,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const msg = parseResponse(trimmed);
          if (msg) {
            this.handleMessage(msg);
          }
        } else if (trimmed.includes('stdin/stdout mode')) {
          this.isConnected = true;
          if (this.readyResolve) {
            this.readyResolve();
            this.readyResolve = null;
          }
        }
      });

      if (this.process.stderr) {
        const stderrRl = createInterface({
          input: this.process.stderr as Readable,
          crlfDelay: Infinity
        });

        stderrRl.on('line', (line) => {
          this.stderrLines.push(line);
        });
      }

      this.process.on('error', (err) => {
        this.isConnected = false;
        if (this.readyResolve) {
          this.readyResolve();
          this.readyResolve = null;
        }
        reject(err);
      });

      this.process.on('exit', (code) => {
        this.isConnected = false;
        if (code !== 0 && code !== null) {
          console.error(chalk.red(`Backend exited with code ${code}`));
          if (this.stderrLines.length > 0) {
            console.error(chalk.gray('  Server errors:'));
            this.stderrLines.slice(-3).forEach(line => {
              console.error(chalk.gray(`    ${line}`));
            });
          }
        }
      });

      setTimeout(() => {
        if (this.readyResolve) {
          this.isConnected = true;
          this.readyResolve();
          this.readyResolve = null;
        }
      }, 2000);
    });
  }

  private handleMessage(msg: IPCMessage): void {
    const pending = this.pendingRequests.get(msg.id);
    if (pending) {
      if (msg.type === 'error') {
        pending.reject(new Error(msg.error || 'Unknown error'));
      } else {
        pending.resolve(msg);
      }
      this.pendingRequests.delete(msg.id);
    }

    const handler = this.messageHandlers.get(msg.id);
    if (handler) {
      handler(msg);
      this.messageHandlers.delete(msg.id);
    }

    if (msg.type === 'stream' && msg.event === 'progress') {
      const streamHandler = this.streamHandlers.get(msg.id);
      if (streamHandler) {
        streamHandler(msg.data as StreamEvent);
      }
    }
  }

  async sendCommand(
    command: string,
    args: string[] = [],
    options: Record<string, unknown> = {},
    existingMsgId?: string,
  ): Promise<IPCMessage> {
    if (!this.isConnected) {
      await this.connect();
    }

    const msgId = existingMsgId ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const msg = {
      type: 'command',
      id: msgId,
      command,
      args,
      options
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(msgId, { resolve, reject });
      this.process?.stdin?.write(JSON.stringify(msg) + '\n');

      setTimeout(() => {
        if (this.pendingRequests.has(msgId)) {
          this.pendingRequests.delete(msgId);
          reject(new Error('Request timeout (30s)'));
        }
      }, 30000);
    });
  }

  onMessage(id: string, handler: MessageHandler): void {
    this.messageHandlers.set(id, handler);
  }

  onStream(id: string, handler: (event: StreamEvent) => void): void {
    this.streamHandlers.set(id, handler);
  }

  disconnect(): void {
    if (this.process) {
      this.process.stdin?.end();
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGTERM');
        }
      }, 2000);
    }
    this.process = null;
    this.isConnected = false;
  }

  forceKill(): void {
    if (this.process) {
      this.process.kill('SIGKILL');
      this.process = null;
      this.isConnected = false;
    }
  }
}

export const ipcClient = new IPCClient();