/**
 * Simple structured logger utility
 */

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLevel = levels[process.env.LOG_LEVEL || 'info'];

const log = (level, message, meta = {}) => {
  if (levels[level] > currentLevel) return;

  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta
  };

  // In production, you might want to send logs to a external service
  if (process.env.NODE_ENV === 'production') {
    // Here you could integrate with services like Winston, Bunyan, or cloud logging services
    console.log(JSON.stringify(logEntry));
  } else {
    // For development, pretty print
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, Object.keys(meta).length ? meta : '');
  }
};

module.exports = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta)
};