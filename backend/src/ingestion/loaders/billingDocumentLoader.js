const path = require('path');
const fs = require('fs');
const { parseJsonlFile } = require('../jsonlParser');
const { getDriver } = require('../../graph/neo4jDriver');

const DATA_DIR = path.join(__dirname, '../../../../sap-o2c-data');
const BATCH_SIZE = 100;

async function load() {
  const driver = getDriver();
  let bdCount = 0;

  // Load billing_document_headers
  const bdDir = path.join(DATA_DIR, 'billing_document_headers');
  const bdFiles = fs.readdirSync(bdDir).filter(f => f.endsWith('.jsonl'));

  for (const file of bdFiles) {
    const records = await parseJsonlFile(path.join(bdDir, file));
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE).map(r => ({
        id: r.billingDocument,
        props: {
          billingDocument: r.billingDocument,
          billingDocumentType: r.billingDocumentType,
          totalNetAmount: r.totalNetAmount,
          transactionCurrency: r.transactionCurrency,
          billingDocumentIsCancelled: r.billingDocumentIsCancelled,
          soldToParty: r.soldToParty,
          accountingDocument: r.accountingDocument,
          creationDate: r.creationDate,
          fiscalYear: r.fiscalYear,
        },
      }));
      const session = driver.session();
      try {
        await session.run(
          `UNWIND $batch AS row
           MERGE (n:BillingDocument {billingDocument: row.id})
           SET n += row.props`,
          { batch }
        );
        bdCount += batch.length;
      } finally {
        await session.close();
      }
    }
  }

  console.log(`billingDocumentLoader: upserted ${bdCount} BillingDocument nodes`);
  return { bdCount };
}

module.exports = { load };
