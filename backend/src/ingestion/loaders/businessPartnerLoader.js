const path = require('path');
const fs = require('fs');
const { parseJsonlFile } = require('../jsonlParser');
const { getDriver } = require('../../graph/neo4jDriver');

const DATA_DIR = path.join(__dirname, '../../../../sap-o2c-data');
const BATCH_SIZE = 100;

async function runBatch(session, query, batch) {
  await session.run(query, { batch });
}

async function load() {
  const driver = getDriver();
  let bpCount = 0;
  let addrCount = 0;

  // Load business_partners
  const bpDir = path.join(DATA_DIR, 'business_partners');
  const bpFiles = fs.readdirSync(bpDir).filter(f => f.endsWith('.jsonl'));

  for (const file of bpFiles) {
    const records = await parseJsonlFile(path.join(bpDir, file));
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE).map(r => ({
        id: r.businessPartner,
        props: {
          businessPartner: r.businessPartner,
          customer: r.customer,
          businessPartnerFullName: r.businessPartnerFullName,
          businessPartnerGrouping: r.businessPartnerGrouping,
          businessPartnerIsBlocked: r.businessPartnerIsBlocked,
          isMarkedForArchiving: r.isMarkedForArchiving,
          organizationBpName1: r.organizationBpName1,
        },
      }));
      const session = driver.session();
      try {
        await runBatch(session,
          `UNWIND $batch AS row
           MERGE (n:BusinessPartner {businessPartner: row.id})
           SET n += row.props`,
          batch
        );
        bpCount += batch.length;
      } finally {
        await session.close();
      }
    }
  }

  // Load business_partner_addresses — merge address props onto existing BP node
  const addrDir = path.join(DATA_DIR, 'business_partner_addresses');
  const addrFiles = fs.readdirSync(addrDir).filter(f => f.endsWith('.jsonl'));

  for (const file of addrFiles) {
    const records = await parseJsonlFile(path.join(addrDir, file));
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE).map(r => ({
        id: r.businessPartner,
        props: {
          addressId: r.addressId,
          cityName: r.cityName,
          country: r.country,
          postalCode: r.postalCode,
          region: r.region,
          streetName: r.streetName,
          addressTimeZone: r.addressTimeZone,
        },
      }));
      const session = driver.session();
      try {
        await runBatch(session,
          `UNWIND $batch AS row
           MERGE (n:BusinessPartner {businessPartner: row.id})
           SET n += row.props`,
          batch
        );
        addrCount += batch.length;
      } finally {
        await session.close();
      }
    }
  }

  console.log(`businessPartnerLoader: upserted ${bpCount} BusinessPartner nodes, ${addrCount} address records`);
  return { bpCount, addrCount };
}

module.exports = { load };
