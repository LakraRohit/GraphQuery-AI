const path = require('path');
const fs = require('fs');
const { parseJsonlFile } = require('../jsonlParser');
const { getDriver } = require('../../graph/neo4jDriver');
const { DATA_DIR } = require('../dataPath');
const BATCH_SIZE = 100;

async function load() {
  const driver = getDriver();
  let soCount = 0;
  let soiCount = 0;

  // Load sales_order_headers
  const soDir = path.join(DATA_DIR, 'sales_order_headers');
  const soFiles = fs.readdirSync(soDir).filter(f => f.endsWith('.jsonl'));

  for (const file of soFiles) {
    const records = await parseJsonlFile(path.join(soDir, file));
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE).map(r => ({
        id: r.salesOrder,
        props: {
          salesOrder: r.salesOrder,
          soldToParty: r.soldToParty,
          totalNetAmount: r.totalNetAmount,
          transactionCurrency: r.transactionCurrency,
          overallDeliveryStatus: r.overallDeliveryStatus,
          creationDate: r.creationDate,
          requestedDeliveryDate: r.requestedDeliveryDate,
          salesOrderType: r.salesOrderType,
          salesOrganization: r.salesOrganization,
        },
      }));
      const session = driver.session();
      try {
        await session.run(
          `UNWIND $batch AS row
           MERGE (n:SalesOrder {salesOrder: row.id})
           SET n += row.props`,
          { batch }
        );
        soCount += batch.length;
      } finally {
        await session.close();
      }
    }
  }

  // Load sales_order_items
  const soiDir = path.join(DATA_DIR, 'sales_order_items');
  const soiFiles = fs.readdirSync(soiDir).filter(f => f.endsWith('.jsonl'));

  for (const file of soiFiles) {
    const records = await parseJsonlFile(path.join(soiDir, file));
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE).map(r => ({
        id: r.salesOrder + '_' + r.salesOrderItem,
        props: {
          salesOrder: r.salesOrder,
          salesOrderItem: r.salesOrderItem,
          material: r.material,
          requestedQuantity: r.requestedQuantity,
          requestedQuantityUnit: r.requestedQuantityUnit,
          netAmount: r.netAmount,
          transactionCurrency: r.transactionCurrency,
          productionPlant: r.productionPlant,
          storageLocation: r.storageLocation,
          materialGroup: r.materialGroup,
        },
      }));
      const session = driver.session();
      try {
        await session.run(
          `UNWIND $batch AS row
           MERGE (n:SalesOrderItem {id: row.id})
           SET n += row.props`,
          { batch }
        );
        soiCount += batch.length;
      } finally {
        await session.close();
      }
    }
  }

  console.log(`salesOrderLoader: upserted ${soCount} SalesOrder nodes, ${soiCount} SalesOrderItem nodes`);
  return { soCount, soiCount };
}

module.exports = { load };
