const { getDriver } = require('../graph/neo4jDriver');

/**
 * Executes a Cypher query and returns plain JS objects.
 * @param {string} cypher
 * @returns {Promise<Array<Object>>}
 */
async function executeCypher(cypher) {
  const driver = getDriver();
  const session = driver.session();

  try {
    const result = await session.run(cypher);
    return result.records.map((record) => record.toObject());
  } catch (err) {
    const msg = err.message || '';
    if (
      err.code === 'ServiceUnavailable' ||
      msg.includes('ServiceUnavailable') ||
      msg.includes('ECONNREFUSED')
    ) {
      const error = new Error('Database unreachable.');
      error.statusCode = 503;
      throw error;
    }
    const error = new Error('Query execution failed.');
    error.statusCode = 500;
    throw error;
  } finally {
    await session.close();
  }
}

module.exports = { executeCypher };
