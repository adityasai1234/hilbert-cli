import { spawn, ChildProcess } from 'child_process';
import { Readable } from 'stream';
import { createInterface } from 'readline';
import chalk from 'chalk';
import { IPCMessage, createCommandMessage, parseResponse, StreamEvent } from './protocol';

export type MessageHandler = (msg: IPCMessage) => void;

export class IPCClient {
  private process: ChildProcess | null = null;
  private messageHandlers: Map<string, MessageHandler> = new Map();
  private streamHandlers: Map<string, (event: StreamEvent) => void> = new Map();
  private pendingRequests: Map<string, { resolve: (value: IPCMessage) => void; reject: (error: Error) => void }> = new Map();
  private isConnected: boolean = false;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn('python', ['-m', 'hilbert', 'server'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
      });

      const rl = createInterface({
        input: this.process.stdout as Readable,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        const msg = parseResponse(line);
        if (msg) {
          this.handleMessage(msg);
        }
      });

      this.process.on('error', (err) => {
        reject(err);
      });

      this.process.on('exit', (code) => {
        this.isConnected = false;
        if (code !== 0) {
          console.error(chalk.red(`Backend exited with code ${code}`));
        }
      });

      setTimeout(() => {
        this.isConnected = true;
        resolve();
      }, 500);
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
    options: Record<string, unknown> = {}
  ): Promise<IPCMessage> {
    if (!this.isConnected) {
      await this.connect();
    }

    const msg = createCommandMessage(command, args, options);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(msg.id, { resolve, reject });
      this.process?.stdin?.write(JSON.stringify(msg) + '\n');

      setTimeout(() => {
        if (this.pendingRequests.has(msg.id)) {
          this.pendingRequests.delete(msg.id);
          reject(new Error('Request timeout'));
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
    this.process?.kill();
    this.process = null;
    this.isConnected = false;
  }
}

export const ipcClient = new IPCClient();