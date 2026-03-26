const path = require('path');

// Use DATA_PATH env var if set (for cloud deployments like Railway)
// Otherwise fall back to relative path from project root
const DATA_DIR = process.env.DATA_PATH ||
  path.join(__dirname, '../../../../sap-o2c-data');

module.exports = { DATA_DIR };
