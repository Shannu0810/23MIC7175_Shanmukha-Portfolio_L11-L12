const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'portfolio-auth-service', environment: process.env.NODE_ENV || 'production' },
  transports: [
    // Console transport for container stdout (picked up by Docker / Kubernetes)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `[${timestamp}] ${level}: ${message} ${metaStr}`;
        })
      )
    }),
    // Structured JSON log files for Filebeat / Logstash ELK ingestion
    new winston.transports.File({
      filename: path.join(logDir, 'portfolio.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'security-audit.log'),
      level: 'warn',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

module.exports = logger;
