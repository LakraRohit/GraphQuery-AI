const path = require('path');
const fs = require('fs');
const { parseJsonlFile } = require('../jsonlParser');
const { getDriver } = require('../../graph/neo4jDriver');

const DATA_DIR = path.join(__dirname, '../../../../sap-o2c-data');
const BATCH_SIZE = 100;

async function load() {
  const driver = getDriver();
  let productCount = 0;
  let descCount = 0;

  // Load products (source field "product" maps to node key "material")
  const prodDir = path.join(DATA_DIR, 'products');
  const prodFiles = fs.readdirSync(prodDir).filter(f => f.endsWith('.jsonl'));

  for (const file of prodFiles) {
    const records = await parseJsonlFile(path.join(prodDir, file));
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE).map(r => ({
        material: r.product,
        props: {
          material: r.product,
          productType: r.productType,
          baseUnit: r.baseUnit,
          grossWeight: r.grossWeight,
          netWeight: r.netWeight,
          productGroup: r.productGroup,
          isMarkedForDeletion: r.isMarkedForDeletion,
        },
      }));
      const session = driver.session();
      try {
        await session.run(
          `UNWIND $batch AS row
           MERGE (n:Product {material: row.material})
           SET n += row.props`,
          { batch }
        );
        productCount += batch.length;
      } finally {
        await session.close();
      }
    }
  }

  // Load product_descriptions (EN only)
  const descDir = path.join(DATA_DIR, 'product_descriptions');
  const descFiles = fs.readdirSync(descDir).filter(f => f.endsWith('.jsonl'));

  for (const file of descFiles) {
    const records = await parseJsonlFile(path.join(descDir, file));
    const enRecords = records.filter(r => r.language === 'EN');
    for (let i = 0; i < enRecords.length; i += BATCH_SIZE) {
      const batch = enRecords.slice(i, i + BATCH_SIZE).map(r => ({
        material: r.product,
        productDescription: r.productDescription,
      }));
      const session = driver.session();
      try {
        await session.run(
          `UNWIND $batch AS row
           MERGE (n:Product {material: row.material})
           SET n.productDescription = row.productDescription`,
          { batch }
        );
        descCount += batch.length;
      } finally {
        await session.close();
      }
    }
  }

  console.log(`productLoader: upserted ${productCount} Product nodes, ${descCount} EN descriptions`);
  return { productCount, descCount };
}

module.exports = { load };
