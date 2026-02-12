/**
 * Lightweight structured logger with log levels and child loggers.
 *
 * - LOG_LEVEL env var controls verbosity: debug | info | warn | error (default: info)
 * - In production (NODE_ENV=production), outputs JSON for machine parsing
 * - In development, outputs human-readable colored text
 * - child(module) creates a scoped logger that tags every line with its source
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Map log level to the corresponding console method.
 */
function consoleMethod(level) {
  if (level === 'debug') return 'log';
  if (level === 'info') return 'info';
  return level; // 'warn' | 'error'
}

/**
 * ANSI color codes for terminal output (development only).
 */
const COLORS = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

function createLogger(context = {}) {
  const threshold = LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info;
  const isProduction = process.env.NODE_ENV === 'production';

  function log(level, message, data = {}) {
    if (LEVELS[level] < threshold) return;

    const time = new Date().toISOString();

    if (isProduction) {
      // Structured JSON output for log aggregators (Railway, etc.)
      const entry = { time, level, ...context, msg: message, ...data };
      console[consoleMethod(level)](JSON.stringify(entry));
    } else {
      // Human-readable colored output for development
      const color = COLORS[level] || '';
      const tag = `${COLORS.dim}[${time}]${COLORS.reset} ${color}${level.toUpperCase()}${COLORS.reset}`;
      const ctx = context.module ? ` ${COLORS.dim}(${context.module})${COLORS.reset}` : '';
      const hasData = data && typeof data === 'object' && Object.keys(data).length > 0;
      console[consoleMethod(level)](`${tag}${ctx}: ${message}`, hasData ? data : '');
    }
  }

  return {
    debug: (msg, data) => log('debug', msg, data),
    info: (msg, data) => log('info', msg, data),
    warn: (msg, data) => log('warn', msg, data),
    error: (msg, data) => log('error', msg, data),
    child: (module) => createLogger({ ...context, module }),
  };
}

export const logger = createLogger();
export default logger;
