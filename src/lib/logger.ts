export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  tag: string;
  message: string;
  data?: any;
}

type LogListener = (logs: LogEntry[]) => void;

class AppLogger {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs: number = 100;
  
  // Environment check: Automatically disabled in production
  public readonly isProduction: boolean = import.meta.env.PROD || process.env.NODE_ENV === 'production';
  public isDebugEnabled: boolean = !this.isProduction;

  constructor() {
    // If in production, ensure debug is off by default
    if (this.isProduction) {
      this.isDebugEnabled = false;
    }
  }

  public setDebugEnabled(enabled: boolean) {
    if (this.isProduction && enabled) {
      console.warn('[Logger] Debug log cannot be manually enabled in production build.');
      return;
    }
    this.isDebugEnabled = enabled;
  }

  private addLog(level: LogLevel, tag: string, message: string, data?: any) {
    // If in production, completely drop debug logs to protect sensitive data and save memory
    if (this.isProduction && level === 'DEBUG') {
      return;
    }

    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(Date.now() % 1000).padStart(3, '0'),
      level,
      tag,
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined,
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Mirror to standard browser console only if not production or if warn/error
    if (!this.isProduction || level === 'ERROR') {
      const consoleMsg = `[DuckPOS ${level}][${tag}] ${message}`;
      if (level === 'ERROR') {
        console.error(consoleMsg, data || '');
      } else if (level === 'WARN') {
        console.warn(consoleMsg, data || '');
      } else if (level === 'INFO') {
        console.info(consoleMsg, data || '');
      } else {
        console.debug(consoleMsg, data || '');
      }
    }

    this.notify();
  }

  public debug(tag: string, message: string, data?: any) {
    if (!this.isDebugEnabled) return;
    this.addLog('DEBUG', tag, message, data);
  }

  public info(tag: string, message: string, data?: any) {
    this.addLog('INFO', tag, message, data);
  }

  public warn(tag: string, message: string, data?: any) {
    this.addLog('WARN', tag, message, data);
  }

  public error(tag: string, message: string, data?: any) {
    this.addLog('ERROR', tag, message, data);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clear() {
    this.logs = [];
    this.notify();
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentLogs = [...this.logs];
    this.listeners.forEach((listener) => {
      try {
        listener(currentLogs);
      } catch (err) {
        console.error('[Logger Subscriber Error]:', err);
      }
    });
  }
}

export const logger = new AppLogger();
