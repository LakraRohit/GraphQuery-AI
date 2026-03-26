const { getDriver } = require('./neo4jDriver');

const constraints = [
  {
    name: 'bp_id',
    cypher: 'CREATE CONSTRAINT bp_id IF NOT EXISTS FOR (n:BusinessPartner) REQUIRE n.businessPartner IS UNIQUE',
    label: 'BusinessPartner.businessPartner',
  },
  {
    name: 'so_id',
    cypher: 'CREATE CONSTRAINT so_id IF NOT EXISTS FOR (n:SalesOrder) REQUIRE n.salesOrder IS UNIQUE',
    label: 'SalesOrder.salesOrder',
  },
  {
    name: 'prod_id',
    cypher: 'CREATE CONSTRAINT prod_id IF NOT EXISTS FOR (n:Product) REQUIRE n.material IS UNIQUE',
    label: 'Product.material',
  },
  {
    name: 'del_id',
    cypher: 'CREATE CONSTRAINT del_id IF NOT EXISTS FOR (n:Delivery) REQUIRE n.deliveryDocument IS UNIQUE',
    label: 'Delivery.deliveryDocument',
  },
  {
    name: 'bd_id',
    cypher: 'CREATE CONSTRAINT bd_id IF NOT EXISTS FOR (n:BillingDocument) REQUIRE n.billingDocument IS UNIQUE',
    label: 'BillingDocument.billingDocument',
  },
  {
    name: 'plant_id',
    cypher: 'CREATE CONSTRAINT plant_id IF NOT EXISTS FOR (n:Plant) REQUIRE n.plant IS UNIQUE',
    label: 'Plant.plant',
  },
  {
    name: 'soi_id',
    cypher: 'CREATE CONSTRAINT soi_id IF NOT EXISTS FOR (n:SalesOrderItem) REQUIRE n.id IS UNIQUE',
    label: 'SalesOrderItem.id (composite: salesOrder_salesOrderItem)',
  },
  {
    name: 'pay_id',
    cypher: 'CREATE CONSTRAINT pay_id IF NOT EXISTS FOR (n:Payment) REQUIRE n.id IS UNIQUE',
    label: 'Payment.id (composite: accountingDocument_accountingDocumentItem)',
  },
];

/**
 * Runs all schema constraint setup statements against Neo4j.
 * Logs success or error for each constraint.
 */
async function runSchemaSetup() {
  const driver = getDriver();
  const session = driver.session();

  try {
    for (const constraint of constraints) {
      try {
        await session.run(constraint.cypher);
        console.log(`[schemaSetup] Constraint created/verified: ${constraint.label}`);
      } catch (err) {
        console.error(`[schemaSetup] Error creating constraint ${constraint.label}:`, err.message);
      }
    }
  } finally {
    await session.close();
  }
}

module.exports = { runSchemaSetup };
