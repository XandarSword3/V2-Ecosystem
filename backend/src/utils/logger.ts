import fs from 'fs';
import os from 'os';
import path from 'path';
import winston from 'winston';
import { config } from '../config/index';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    // info carries any extra fields passed as logger.error(msg, { ...meta })
    // merged in by winston (the "splat"). Previously only timestamp/level/
    // message were read here, so every meta object (error stacks, request
    // path/method, requestId) was silently dropped — every "Unexpected
    // error:" line in the logs carried zero diagnostic detail.
    const { timestamp, level, message, ...meta } = info;
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      try {
        metaStr = ' ' + JSON.stringify(meta, null, 0);
      } catch {
        metaStr = ' [unserializable meta]';
      }
    }
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

// Determine a safe log directory. Priority:
// 1. LOG_DIR environment variable (if provided)
// 2. ./logs relative to project root (if writable)
// 3. OS temp directory (always writable in most environments)
const preferred = process.env.LOG_DIR;
const defaultTmp = path.join(os.tmpdir(), 'v2-ecosystem-logs');
let logDir: string | null = null;

try {
  if (preferred) {
    fs.mkdirSync(preferred, { recursive: true });
    logDir = preferred;
  } else {
    // Try to use ./logs first for local dev convenience
    try {
      const localLogs = path.join(process.cwd(), 'logs');
      fs.mkdirSync(localLogs, { recursive: true });
      logDir = localLogs;
    } catch (e) {
      // fallback to OS temp directory
      fs.mkdirSync(defaultTmp, { recursive: true });
      logDir = defaultTmp;
    }
  }
} catch (err) {
  // If we cannot create any directory, disable file transports and continue
  // This prevents the app from crashing during startup in restrictive environments
  // and will log to console only.
  // eslint-disable-next-line no-console
  console.error('Warning: Unable to create log directory for file transports, file logging disabled.', err);
  logDir = null;
}

const transports: winston.transport[] = [new winston.transports.Console()];

if (config.env === 'production') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    })
  );
}

if (logDir) {
  try {
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
      })
    );

    transports.push(
      new winston.transports.File({ filename: path.join(logDir, 'all.log') })
    );
  } catch (err) {
    // If file transports fail for any reason, keep console transport and warn
    // eslint-disable-next-line no-console
    console.error('Warning: Failed to initialize file transports for logging. Falling back to console only.', err);
  }
}

export const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'warn',
  levels,
  format,
  transports,
});
