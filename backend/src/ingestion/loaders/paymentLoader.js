const path = require('path');
const fs = require('fs');
const { parseJsonlFile } = require('../jsonlParser');
const { getDriver } = require('../../graph/neo4jDriver');
const { DATA_DIR } = require('../dataPath');
const BATCH_SIZE = 100;

async function load() {
  const driver = getDriver();
  let paymentCount = 0;

  // Load payments_accounts_receivable
  const payDir = path.join(DATA_DIR, 'payments_accounts_receivable');
  const payFiles = fs.readdirSync(payDir).filter(f => f.endsWith('.jsonl'));

  for (const file of payFiles) {
    const records = await parseJsonlFile(path.join(payDir, file));
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE).map(r => ({
        id: r.accountingDocument + '_' + r.accountingDocumentItem,
        props: {
          accountingDocument: r.accountingDocument,
          accountingDocumentItem: r.accountingDocumentItem,
          clearingDate: r.clearingDate,
          amountInTransactionCurrency: r.amountInTransactionCurrency,
          transactionCurrency: r.transactionCurrency,
          customer: r.customer,
          companyCode: r.companyCode,
          fiscalYear: r.fiscalYear,
          postingDate: r.postingDate,
        },
      }));
      const session = driver.session();
      try {
        await session.run(
          `UNWIND $batch AS row
           MERGE (n:Payment {id: row.id})
           SET n += row.props`,
          { batch }
        );
        paymentCount += batch.length;
      } finally {
        await session.close();
      }
    }
  }

  console.log(`paymentLoader: upserted ${paymentCount} Payment nodes`);
  return { paymentCount };
}

module.exports = { load };
