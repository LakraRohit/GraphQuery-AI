const { getDriver } = require('./neo4jDriver');

/**
 * Fetches all nodes and relationships from Neo4j.
 * @returns {{ nodes: Array, edges: Array }}
 */
async function getGraph() {
  const driver = getDriver();
  const session = driver.session();

  try {
    // Fetch all nodes
    const nodeResult = await session.run('MATCH (n) RETURN n');
    const nodes = nodeResult.records.map((record) => {
      const node = record.get('n');
      const id = node.elementId != null ? node.elementId : node.identity.toString();
      return {
        id,
        label: node.labels[0],
        properties: node.properties,
      };
    });

    // Fetch all relationships
    const relResult = await session.run('MATCH ()-[r]->() RETURN r');
    const edges = relResult.records.map((record) => {
      const rel = record.get('r');
      const id = rel.elementId != null ? rel.elementId : rel.identity.toString();
      return {
        id,
        source: rel.startNodeElementId != null ? rel.startNodeElementId : rel.start.toString(),
        target: rel.endNodeElementId != null ? rel.endNodeElementId : rel.end.toString(),
        type: rel.type,
      };
    });

    return { nodes, edges };
  } finally {
    await session.close();
  }
}

module.exports = { getGraph };
