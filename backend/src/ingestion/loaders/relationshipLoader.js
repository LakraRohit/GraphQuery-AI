const path = require('path');
const fs = require('fs');
const { parseJsonlFile } = require('../jsonlParser');
const { getDriver } = require('../../graph/neo4jDriver');

const DATA_DIR = path.join(__dirname, '../../../../sap-o2c-data');
const BATCH_SIZE = 100;

async function runBatchQuery(driver, cypher, batch) {
  const session = driver.session();
  try {
    await session.run(cypher, { batch });
  } finally {
    await session.close();
  }
}

/**
 * 1. PLACED_BY: SalesOrder → BusinessPartner via soldToParty
 */
async function loadPlacedBy(driver) {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (so:SalesOrder), (bp:BusinessPartner {businessPartner: so.soldToParty})
       MERGE (so)-[:PLACED_BY]->(bp)`
    );
    console.log('relationshipLoader: PLACED_BY done');
  } finally {
    await session.close();
  }
}

/**
 * 2. CONTAINS: SalesOrder → SalesOrderItem via composite id prefix
 */
async function loadContains(driver) {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (so:SalesOrder), (soi:SalesOrderItem)
       WHERE soi.id STARTS WITH so.salesOrder + '_'
       MERGE (so)-[:CONTAINS]->(soi)`
    );
    console.log('relationshipLoader: CONTAINS done');
  } finally {
    await session.close();
  }
}

/**
 * 3. ORDERS: SalesOrderItem → Product via material
 */
async function loadOrders(driver) {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (soi:SalesOrderItem), (p:Product {material: soi.material})
       MERGE (soi)-[:ORDERS]->(p)`
    );
    console.log('relationshipLoader: ORDERS done');
  } finally {
    await session.close();
  }
}

/**
 * 4. FULFILLED_BY: SalesOrder → Delivery via outbound_delivery_items.referenceSdDocument
 */
async function loadFulfilledBy(driver) {
  const itemDir = path.join(DATA_DIR, 'outbound_delivery_items');
  const itemFiles = fs.readdirSync(itemDir).filter(f => f.endsWith('.jsonl'));

  // Collect unique (referenceSdDocument → deliveryDocument) pairs
  const pairMap = new Map();
  for (const file of itemFiles) {
    const records = await parseJsonlFile(path.join(itemDir, file));
    for (const r of records) {
      if (r.referenceSdDocument && r.deliveryDocument) {
        pairMap.set(r.referenceSdDocument + '|' + r.deliveryDocument, {
          salesOrder: r.referenceSdDocument,
          deliveryDocument: r.deliveryDocument,
        });
      }
    }
  }

  const pairs = Array.from(pairMap.values());
  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    const batch = pairs.slice(i, i + BATCH_SIZE);
    await runBatchQuery(driver,
      `UNWIND $batch AS row
       MATCH (so:SalesOrder {salesOrder: row.salesOrder}), (d:Delivery {deliveryDocument: row.deliveryDocument})
       MERGE (so)-[:FULFILLED_BY]->(d)`,
      batch
    );
  }
  console.log(`relationshipLoader: FULFILLED_BY done (${pairs.length} pairs)`);
}

/**
 * 5. BILLED_AS: Delivery → BillingDocument via billing_document_items.referenceSdDocument (=deliveryDocument)
 */
async function loadBilledAs(driver) {
  const itemDir = path.join(DATA_DIR, 'billing_document_items');
  const itemFiles = fs.readdirSync(itemDir).filter(f => f.endsWith('.jsonl'));

  // Collect unique (referenceSdDocument=deliveryDocument → billingDocument) pairs
  const pairMap = new Map();
  for (const file of itemFiles) {
    const records = await parseJsonlFile(path.join(itemDir, file));
    for (const r of records) {
      if (r.referenceSdDocument && r.billingDocument) {
        pairMap.set(r.referenceSdDocument + '|' + r.billingDocument, {
          deliveryDocument: r.referenceSdDocument,
          billingDocument: r.billingDocument,
        });
      }
    }
  }

  const pairs = Array.from(pairMap.values());
  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    const batch = pairs.slice(i, i + BATCH_SIZE);
    await runBatchQuery(driver,
      `UNWIND $batch AS row
       MATCH (d:Delivery {deliveryDocument: row.deliveryDocument}), (bd:BillingDocument {billingDocument: row.billingDocument})
       MERGE (d)-[:BILLED_AS]->(bd)`,
      batch
    );
  }
  console.log(`relationshipLoader: BILLED_AS done (${pairs.length} pairs)`);
}

/**
 * 6. CLEARED_BY: BillingDocument → Payment via accountingDocument
 */
async function loadClearedBy(driver) {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (bd:BillingDocument), (p:Payment {accountingDocument: bd.accountingDocument})
       MERGE (bd)-[:CLEARED_BY]->(p)`
    );
    console.log('relationshipLoader: CLEARED_BY done');
  } finally {
    await session.close();
  }
}

/**
 * 7. PRODUCED_AT: SalesOrderItem → Plant via productionPlant
 */
async function loadProducedAt(driver) {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (soi:SalesOrderItem), (pl:Plant {plant: soi.productionPlant})
       MERGE (soi)-[:PRODUCED_AT]->(pl)`
    );
    console.log('relationshipLoader: PRODUCED_AT done');
  } finally {
    await session.close();
  }
}

/**
 * Run all 7 relationship loaders in order.
 */
async function loadRelationships() {
  const driver = getDriver();
  await loadPlacedBy(driver);
  await loadContains(driver);
  await loadOrders(driver);
  await loadFulfilledBy(driver);
  await loadBilledAs(driver);
  await loadClearedBy(driver);
  await loadProducedAt(driver);
  console.log('relationshipLoader: all relationships loaded');
}

module.exports = { loadRelationships };
