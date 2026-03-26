const path = require('path');
const fs = require('fs');
const { parseJsonlFile } = require('../jsonlParser');
const { getDriver } = require('../../graph/neo4jDriver');

const DATA_DIR = path.join(__dirname, '../../../../sap-o2c-data');
const BATCH_SIZE = 100;

async function load() {
  const driver = getDriver();
  let deliveryCount = 0;

  // Load outbound_delivery_headers
  const delDir = path.join(DATA_DIR, 'outbound_delivery_headers');
  const delFiles = fs.readdirSync(delDir).filter(f => f.endsWith('.jsonl'));

  for (const file of delFiles) {
    const records = await parseJsonlFile(path.join(delDir, file));
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE).map(r => ({
        id: r.deliveryDocument,
        props: {
          deliveryDocument: r.deliveryDocument,
          creationDate: r.creationDate,
          overallGoodsMovementStatus: r.overallGoodsMovementStatus,
          overallPickingStatus: r.overallPickingStatus,
          shippingPoint: r.shippingPoint,
        },
      }));
      const session = driver.session();
      try {
        await session.run(
          `UNWIND $batch AS row
           MERGE (n:Delivery {deliveryDocument: row.id})
           SET n += row.props`,
          { batch }
        );
        deliveryCount += batch.length;
      } finally {
        await session.close();
      }
    }
  }

  console.log(`deliveryLoader: upserted ${deliveryCount} Delivery nodes`);
  return { deliveryCount };
}

module.exports = { load };
