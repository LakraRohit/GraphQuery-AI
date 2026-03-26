require('dotenv').config();
const app = require('./app');
const { runSchemaSetup } = require('./graph/schemaSetup');
const { runIngestion } = require('./ingestion/ingestionService');

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await runSchemaSetup();
    console.log('[server] Schema setup complete.');
  } catch (err) {
    console.error('[server] Schema setup failed:', err.message);
  }

  try {
    await runIngestion();
    console.log('[server] Ingestion complete.');
  } catch (err) {
    console.error('[server] Ingestion failed:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
  });
}

start();
