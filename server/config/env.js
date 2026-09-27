const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

function validateEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  process.env.NODE_ENV = nodeEnv;

  const errors = [];

  if (!process.env.MONGODB_URI || !process.env.MONGODB_URI.trim()) {
    errors.push('MONGODB_URI environment variable is missing.');
  }

  if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
    errors.push('JWT_SECRET environment variable is missing.');
  } else if (nodeEnv === 'production' && process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long in production.');
  }

  const port = Number(process.env.PORT) || 3000;
  const maxContentLength = Number(process.env.MAX_CONTENT_LENGTH) || 1024 * 1024;

  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT must be a valid TCP port.');
  if (!Number.isInteger(maxContentLength) || maxContentLength < 1024 || maxContentLength > 10 * 1024 * 1024) {
    errors.push('MAX_CONTENT_LENGTH must be between 1024 bytes and 10 MB.');
  }

  if (errors.length > 0) {
    console.error('\n========================================');
    console.error('ENVIRONMENT CONFIGURATION ERROR:');
    errors.forEach(err => console.error(` - ${err}`));
    console.error('========================================\n');
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  return {
    PORT: port,
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: nodeEnv,
    APP_BASE_URL: process.env.APP_BASE_URL || `http://localhost:${port}`,
    CORS_ORIGIN: process.env.CORS_ORIGIN || process.env.APP_BASE_URL || `http://localhost:${port}`,
    MAX_CONTENT_LENGTH: maxContentLength,
    PYTHON_EXECUTABLE: process.env.PYTHON_EXECUTABLE || (process.platform === 'win32' ? 'py' : 'python3'),
    PYTHON_SERVICE_URL: process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:5000',
    PYTHON_SERVICE_TIMEOUT_MS: Number(process.env.PYTHON_SERVICE_TIMEOUT_MS) || 8000
  };
}

module.exports = { validateEnv };
