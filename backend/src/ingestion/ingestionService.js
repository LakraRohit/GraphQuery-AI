const {
  plantLoader,
  productLoader,
  businessPartnerLoader,
  salesOrderLoader,
  deliveryLoader,
  billingDocumentLoader,
  paymentLoader,
  loadRelationships,
} = require('./loaders/index.js');

async function runIngestion() {
  const overallStart = Date.now();
  console.log('[ingestion] Starting ingestion pipeline...');

  const steps = [
    { name: 'plantLoader',            fn: () => plantLoader.load() },
    { name: 'productLoader',          fn: () => productLoader.load() },
    { name: 'businessPartnerLoader',  fn: () => businessPartnerLoader.load() },
    { name: 'salesOrderLoader',       fn: () => salesOrderLoader.load() },
    { name: 'deliveryLoader',         fn: () => deliveryLoader.load() },
    { name: 'billingDocumentLoader',  fn: () => billingDocumentLoader.load() },
    { name: 'paymentLoader',          fn: () => paymentLoader.load() },
    { name: 'loadRelationships',      fn: () => loadRelationships() },
  ];

  for (const step of steps) {
    const start = Date.now();
    console.log(`[ingestion] Starting ${step.name}...`);
    const count = await step.fn();
    const elapsed = Date.now() - start;
    console.log(`[ingestion] ${step.name} complete — records: ${count ?? 'n/a'}, time: ${elapsed}ms`);
  }

  const totalElapsed = Date.now() - overallStart;
  console.log(`[ingestion] Pipeline complete. Total elapsed: ${totalElapsed}ms`);
}

module.exports = { runIngestion };
