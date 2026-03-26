const path = require('path');
const fs = require('fs');
const { parseJsonlFile } = require('../jsonlParser');
const { getDriver } = require('../../graph/neo4jDriver');

const DATA_DIR = path.join(__dirname, '../../../../sap-o2c-data');
const BATCH_SIZE = 100;

async function load() {
  const driver = getDriver();
  let plantCount = 0;

  // Load plants
  const plantDir = path.join(DATA_DIR, 'plants');
  const plantFiles = fs.readdirSync(plantDir).filter(f => f.endsWith('.jsonl'));

  for (const file of plantFiles) {
    const records = await parseJsonlFile(path.join(plantDir, file));
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE).map(r => ({
        id: r.plant,
        props: {
          plant: r.plant,
          plantName: r.plantName,
          salesOrganization: r.salesOrganization,
          factoryCalendar: r.factoryCalendar,
          isMarkedForArchiving: r.isMarkedForArchiving,
        },
      }));
      const session = driver.session();
      try {
        await session.run(
          `UNWIND $batch AS row
           MERGE (n:Plant {plant: row.id})
           SET n += row.props`,
          { batch }
        );
        plantCount += batch.length;
      } finally {
        await session.close();
      }
    }
  }

  console.log(`plantLoader: upserted ${plantCount} Plant nodes`);
  return { plantCount };
}

module.exports = { load };
