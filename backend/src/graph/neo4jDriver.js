require('dotenv').config();
const neo4j = require('neo4j-driver');

let driver = null;

/**
 * Returns the singleton Neo4j driver instance, creating it if necessary.
 * @returns {neo4j.Driver}
 */
function getDriver() {
  if (!driver) {
    const uri = process.env.NEO4J_URI;
    const user = process.env.NEO4J_USER;
    const password = process.env.NEO4J_PASSWORD;

    driver = neo4j.driver(
      uri,
      neo4j.auth.basic(user, password),
      {
        connectionTimeout: 5000,
        maxTransactionRetryTime: 5000,
      }
    );
  }
  return driver;
}

/**
 * Closes the Neo4j driver and resets the singleton.
 */
async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

module.exports = { getDriver, closeDriver };
