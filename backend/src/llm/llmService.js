const Groq = require('groq-sdk');

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  throw new Error(
    'GROQ_API_KEY environment variable is not set. ' +
    'Please set it before starting the server.'
  );
}

const groq = new Groq({ apiKey });

const MODEL = 'llama-3.3-70b-versatile';

const SCHEMA_DESCRIPTION = `
You are a Neo4j Cypher query expert. The graph database has the following schema:

Nodes:
- BusinessPartner(businessPartner, businessPartnerFullName, businessPartnerGrouping, businessPartnerIsBlocked, cityName, country)
- SalesOrder(salesOrder, soldToParty, totalNetAmount, transactionCurrency, overallDeliveryStatus, creationDate)
- SalesOrderItem(id, salesOrder, salesOrderItem, material, requestedQuantity, netAmount, productionPlant)
- Product(material, productDescription, baseUnit, productType)
- Delivery(deliveryDocument, overallGoodsMovementStatus, overallPickingStatus, shippingPoint, creationDate)
- BillingDocument(billingDocument, totalNetAmount, transactionCurrency, billingDocumentIsCancelled, soldToParty, accountingDocument)
- Payment(id, accountingDocument, amountInTransactionCurrency, transactionCurrency, clearingDate, customer)
- Plant(plant, plantName)

Relationships:
- (SalesOrder)-[:PLACED_BY]->(BusinessPartner)
- (SalesOrder)-[:CONTAINS]->(SalesOrderItem)
- (SalesOrderItem)-[:ORDERS]->(Product)
- (SalesOrderItem)-[:PRODUCED_AT]->(Plant)
- (SalesOrder)-[:FULFILLED_BY]->(Delivery)
- (Delivery)-[:BILLED_AS]->(BillingDocument)
- (BillingDocument)-[:CLEARED_BY]->(Payment)

CRITICAL RULES — always follow these:
1. ALL numeric fields are stored as STRINGS. Always use toFloat() when doing math:
   - SUM(toFloat(soi.netAmount))
   - SUM(toFloat(so.totalNetAmount))
   - SUM(toFloat(p.amountInTransactionCurrency))
2. For product name searches always use: toLower(p.productDescription) CONTAINS toLower('search term')
3. To find orders for a product: MATCH (soi:SalesOrderItem)-[:ORDERS]->(p:Product) WHERE toLower(p.productDescription) CONTAINS toLower('product name')
4. Always use LIMIT 100 unless the query is a pure aggregation (COUNT, SUM, AVG).
5. Return meaningful aliases. Example: RETURN SUM(toFloat(soi.netAmount)) AS totalNetAmount
6. "Journal entry number" or "accounting document" refers to the accountingDocument property on BillingDocument nodes.
   Example: MATCH (bd:BillingDocument {billingDocument: '91150187'}) RETURN bd.accountingDocument AS journalEntryNumber

EXAMPLE QUERIES:
- Products with most billing documents:
  MATCH (p:Product)<-[:ORDERS]-(soi:SalesOrderItem)<-[:CONTAINS]-(so:SalesOrder)-[:FULFILLED_BY]->(d:Delivery)-[:BILLED_AS]->(bd:BillingDocument)
  RETURN p.material, p.productDescription, COUNT(DISTINCT bd) AS billingCount
  ORDER BY billingCount DESC LIMIT 10

- Trace full flow of a billing document (Sales Order → Delivery → Billing → Journal Entry):
  MATCH (so:SalesOrder)-[:FULFILLED_BY]->(d:Delivery)-[:BILLED_AS]->(bd:BillingDocument)
  WHERE bd.billingDocument = '90504248'
  OPTIONAL MATCH (bd)-[:CLEARED_BY]->(pay:Payment)
  RETURN so.salesOrder, d.deliveryDocument, bd.billingDocument, bd.accountingDocument AS journalEntry, pay.id AS paymentId

- Sales orders delivered but not billed (incomplete flow):
  MATCH (so:SalesOrder)-[:FULFILLED_BY]->(d:Delivery)
  WHERE NOT (d)-[:BILLED_AS]->(:BillingDocument)
  RETURN so.salesOrder, d.deliveryDocument LIMIT 100

- Sales orders with billing but no payment (unpaid invoices):
  MATCH (d:Delivery)-[:BILLED_AS]->(bd:BillingDocument)
  WHERE NOT (bd)-[:CLEARED_BY]->(:Payment)
  RETURN bd.billingDocument, bd.totalNetAmount, bd.soldToParty LIMIT 100

- Sales orders with no delivery (order not fulfilled):
  MATCH (so:SalesOrder)
  WHERE NOT (so)-[:FULFILLED_BY]->(:Delivery)
  RETURN so.salesOrder, so.creationDate, so.soldToParty LIMIT 100

- Full O2C flow for a sales order:
  MATCH (so:SalesOrder)-[:PLACED_BY]->(bp:BusinessPartner)
  OPTIONAL MATCH (so)-[:FULFILLED_BY]->(d:Delivery)
  OPTIONAL MATCH (d)-[:BILLED_AS]->(bd:BillingDocument)
  OPTIONAL MATCH (bd)-[:CLEARED_BY]->(pay:Payment)
  RETURN so.salesOrder, bp.businessPartnerFullName, d.deliveryDocument, bd.billingDocument, bd.accountingDocument AS journalEntry, pay.id AS paymentId LIMIT 100
`.trim();

const TIMEOUT_MS = 30000;

function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('LLM request timed out')), ms)
  );
  return Promise.race([promise, timeout]);
}

function stripMarkdownFences(text) {
  return text
    .replace(/^```(?:cypher)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

/**
 * Generates a Cypher query from a natural language question.
 * @param {string} userQuery
 * @returns {Promise<string>} Cypher query string
 */
async function generateCypher(userQuery) {
  try {
    const response = await withTimeout(
      groq.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `${SCHEMA_DESCRIPTION}\n\nGenerate ONLY a valid Cypher query with no explanation, no markdown, no code fences. Return only the raw Cypher statement.`,
          },
          {
            role: 'user',
            content: userQuery,
          },
        ],
        temperature: 0,
        max_tokens: 512,
      }),
      TIMEOUT_MS
    );

    const text = response.choices?.[0]?.message?.content || '';
    return stripMarkdownFences(text);
  } catch (err) {
    console.error('❌ Groq generateCypher ERROR:', err.message || err);
    const error = new Error('LLM service unavailable.');
    error.statusCode = 502;
    throw error;
  }
}

/**
 * Generates a natural language answer from query results.
 * @param {string} userQuery
 * @param {Array} results
 * @returns {Promise<string>} Natural language answer
 */
async function generateAnswer(userQuery, results) {
  if (!results || results.length === 0) {
    return 'No matching data was found in the dataset.';
  }

  const resultsStr = JSON.stringify(results).slice(0, 2000);

  try {
    const response = await withTimeout(
      groq.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful business analyst. Answer questions concisely based only on the provided data.',
          },
          {
            role: 'user',
            content: `Based on this data: ${resultsStr}\n\nAnswer this question concisely: ${userQuery}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 512,
      }),
      TIMEOUT_MS
    );

    const text = response.choices?.[0]?.message?.content || '';
    return text.trim();
  } catch (err) {
    console.error('❌ Groq generateAnswer ERROR:', err.message || err);
    const error = new Error('LLM service unavailable.');
    error.statusCode = 502;
    throw error;
  }
}

module.exports = { generateCypher, generateAnswer };
