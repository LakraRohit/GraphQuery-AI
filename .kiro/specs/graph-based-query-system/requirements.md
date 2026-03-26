# Requirements Document

## Introduction

This document defines requirements for a Graph-Based Data Modeling and Query System built on top of SAP Order-to-Cash (O2C) business data. The system ingests JSONL files from the `sap-o2c-data` directory, constructs a property graph in Neo4j, visualizes it in a React frontend, and exposes a natural-language chat interface powered by Google Gemini. Users can ask business questions in plain English; the system translates them into Cypher queries, executes them, and returns data-backed answers. Queries unrelated to the dataset are rejected by guardrails.

---

## Glossary

- **System**: The full Graph-Based Data Modeling and Query System (frontend + backend).
- **Ingestion_Service**: The backend component responsible for reading, parsing, and loading JSONL files into the database.
- **Graph_DB**: The Neo4j database instance that stores nodes and relationships.
- **Graph_API**: The Express.js REST API that serves graph data and handles chat queries.
- **LLM_Service**: The backend component that communicates with the Google Gemini API.
- **Query_Engine**: The backend component that executes Cypher queries against Graph_DB.
- **Guardrail**: The validation layer that classifies user queries as in-scope or out-of-scope.
- **Graph_Viewer**: The React Flow-based frontend component that renders the graph.
- **Chat_Interface**: The frontend component that accepts user input and displays responses.
- **BusinessPartner**: A node representing a customer entity, sourced from `business_partners` and `business_partner_addresses`.
- **SalesOrder**: A node representing a sales order header, sourced from `sales_order_headers`.
- **SalesOrderItem**: A node representing a line item on a sales order, sourced from `sales_order_items`.
- **Product**: A node representing a material/product, sourced from `products` and `product_descriptions`.
- **Delivery**: A node representing an outbound delivery, sourced from `outbound_delivery_headers` and `outbound_delivery_items`.
- **BillingDocument**: A node representing an invoice/billing document, sourced from `billing_document_headers` and `billing_document_items`.
- **Payment**: A node representing a payment clearing entry, sourced from `payments_accounts_receivable`.
- **Plant**: A node representing a production or storage plant, sourced from `plants`.
- **JSONL**: Newline-delimited JSON format used by all source data files.
- **Cypher**: The query language used by Neo4j.
- **O2C**: Order-to-Cash business process (Sales Order → Delivery → Billing → Payment).

---

## Requirements

### Requirement 1: JSONL Data Ingestion

**User Story:** As a system administrator, I want the system to read and parse all JSONL files from the `sap-o2c-data` directory, so that the raw business data is available for graph construction.

#### Acceptance Criteria

1. WHEN the Ingestion_Service starts, THE Ingestion_Service SHALL read all JSONL files from each subdirectory of `sap-o2c-data`, including `sales_order_headers`, `sales_order_items`, `sales_order_schedule_lines`, `billing_document_headers`, `billing_document_items`, `billing_document_cancellations`, `business_partners`, `business_partner_addresses`, `customer_company_assignments`, `customer_sales_area_assignments`, `outbound_delivery_headers`, `outbound_delivery_items`, `payments_accounts_receivable`, `journal_entry_items_accounts_receivable`, `products`, `product_descriptions`, `product_plants`, `product_storage_locations`, and `plants`.
2. WHEN a JSONL file contains multiple lines, THE Ingestion_Service SHALL parse each line as an independent JSON object.
3. IF a JSONL line is malformed or cannot be parsed as valid JSON, THEN THE Ingestion_Service SHALL log the file path, line number, and error message, and continue processing remaining lines.
4. IF a subdirectory contains multiple part files, THE Ingestion_Service SHALL process all part files within that subdirectory.
5. THE Ingestion_Service SHALL expose a mechanism to re-run ingestion without duplicating existing nodes or relationships in Graph_DB (idempotent upsert).

---

### Requirement 2: Graph Construction

**User Story:** As a data engineer, I want the parsed data to be modeled as a property graph with typed nodes and relationships, so that the O2C business process is accurately represented for querying and visualization.

#### Acceptance Criteria

1. THE Ingestion_Service SHALL create a `BusinessPartner` node for each record in `business_partners`, keyed on `businessPartner`, with properties including `businessPartnerFullName`, `businessPartnerGrouping`, `businessPartnerIsBlocked`, and `isMarkedForArchiving`.
2. THE Ingestion_Service SHALL create a `SalesOrder` node for each record in `sales_order_headers`, keyed on `salesOrder`, with properties including `soldToParty`, `totalNetAmount`, `transactionCurrency`, `overallDeliveryStatus`, `creationDate`, and `requestedDeliveryDate`.
3. THE Ingestion_Service SHALL create a `SalesOrderItem` node for each record in `sales_order_items`, keyed on the composite key `(salesOrder, salesOrderItem)`, with properties including `material`, `requestedQuantity`, `requestedQuantityUnit`, and `netAmount`.
4. THE Ingestion_Service SHALL create a `Product` node for each unique `material` value in `sales_order_items`, enriched with data from `products` and `product_descriptions` where available.
5. THE Ingestion_Service SHALL create a `Delivery` node for each record in `outbound_delivery_headers`, keyed on the delivery document number.
6. THE Ingestion_Service SHALL create a `BillingDocument` node for each record in `billing_document_headers`, keyed on `billingDocument`, with properties including `totalNetAmount`, `transactionCurrency`, `billingDocumentIsCancelled`, and `soldToParty`.
7. THE Ingestion_Service SHALL create a `Payment` node for each record in `payments_accounts_receivable`, keyed on `(accountingDocument, accountingDocumentItem)`, with properties including `amountInTransactionCurrency`, `transactionCurrency`, `clearingDate`, and `customer`.
8. THE Ingestion_Service SHALL create a `Plant` node for each record in `plants`, keyed on the plant identifier.
9. THE Ingestion_Service SHALL create a `PLACED_BY` relationship from each `SalesOrder` node to its corresponding `BusinessPartner` node, using `soldToParty` as the join key.
10. THE Ingestion_Service SHALL create a `CONTAINS` relationship from each `SalesOrder` node to each of its `SalesOrderItem` nodes.
11. THE Ingestion_Service SHALL create an `ORDERS` relationship from each `SalesOrderItem` node to its corresponding `Product` node, using `material` as the join key.
12. THE Ingestion_Service SHALL create a `FULFILLED_BY` relationship from each `SalesOrder` node to its corresponding `Delivery` node, using the delivery reference on the sales order.
13. THE Ingestion_Service SHALL create a `BILLED_AS` relationship from each `Delivery` node to its corresponding `BillingDocument` node.
14. THE Ingestion_Service SHALL create a `CLEARED_BY` relationship from each `BillingDocument` node to its corresponding `Payment` node, using `accountingDocument` as the join key.
15. THE Ingestion_Service SHALL create a `PRODUCED_AT` relationship from each `Product` node to its corresponding `Plant` node, using `productionPlant` from `sales_order_items`.
16. WHEN Graph_DB already contains nodes with the same key, THE Ingestion_Service SHALL merge (upsert) rather than create duplicate nodes.

---

### Requirement 3: Graph Data API

**User Story:** As a frontend developer, I want a REST endpoint that returns the full graph structure, so that the Graph_Viewer can render nodes and edges.

#### Acceptance Criteria

1. THE Graph_API SHALL expose a `GET /graph` endpoint that returns a JSON response containing two arrays: `nodes` and `edges`.
2. WHEN `GET /graph` is called, THE Graph_API SHALL return each node with at minimum the fields: `id`, `label` (node type), and `properties` (key-value metadata).
3. WHEN `GET /graph` is called, THE Graph_API SHALL return each edge with at minimum the fields: `id`, `source` (source node id), `target` (target node id), and `type` (relationship type).
4. IF Graph_DB is unreachable, THEN THE Graph_API SHALL return HTTP 503 with a JSON error body containing a `message` field.
5. THE Graph_API SHALL respond to `GET /graph` within 5000ms for datasets up to 10,000 nodes and 50,000 edges.

---

### Requirement 4: Graph Visualization

**User Story:** As a business analyst, I want to see the O2C graph rendered interactively in the browser, so that I can explore relationships between customers, orders, products, deliveries, invoices, and payments.

#### Acceptance Criteria

1. THE Graph_Viewer SHALL render all nodes and edges returned by `GET /graph` using React Flow.
2. THE Graph_Viewer SHALL display each node with a visual label indicating its type (e.g., `BusinessPartner`, `SalesOrder`, `Product`).
3. WHEN a user clicks a node, THE Graph_Viewer SHALL display a metadata panel showing all properties of that node.
4. THE Graph_Viewer SHALL support pan and zoom interactions natively provided by React Flow.
5. WHEN the graph data is loading, THE Graph_Viewer SHALL display a loading indicator.
6. IF the `GET /graph` request fails, THEN THE Graph_Viewer SHALL display an error message to the user.
7. THE Graph_Viewer SHALL visually distinguish node types using distinct colors or icons.

---

### Requirement 5: Chat Interface

**User Story:** As a business user, I want to type natural language questions about the O2C data and receive answers, so that I can get business insights without writing queries.

#### Acceptance Criteria

1. THE Chat_Interface SHALL provide a text input field and a submit button for entering user queries.
2. WHEN a user submits a query, THE Chat_Interface SHALL send the query text to `POST /query` and display the response.
3. WHILE a query is being processed, THE Chat_Interface SHALL display a loading indicator and disable the submit button.
4. THE Chat_Interface SHALL display the conversation history, showing both user messages and system responses in chronological order.
5. IF the `POST /query` request fails with a network error, THEN THE Chat_Interface SHALL display an error message without clearing the conversation history.

---

### Requirement 6: Natural Language to Cypher Translation

**User Story:** As a developer, I want user queries to be automatically translated into Cypher queries using the Gemini LLM, so that the system can answer questions from the graph database without manual query writing.

#### Acceptance Criteria

1. WHEN `POST /query` receives a request body containing a `query` string, THE LLM_Service SHALL send the query to the Google Gemini API using the key stored in `process.env.GEMINI_API_KEY`.
2. THE LLM_Service SHALL include a system prompt that describes the graph schema (node labels, relationship types, and key properties) so that Gemini generates valid Cypher.
3. WHEN Gemini returns a Cypher query, THE LLM_Service SHALL extract the Cypher statement from the response before passing it to the Query_Engine.
4. IF the Gemini API returns an error or times out after 30 seconds, THEN THE LLM_Service SHALL return HTTP 502 with a JSON error body containing a `message` field.
5. THE LLM_Service SHALL not expose the raw Gemini API response or internal system prompt to the client.

---

### Requirement 7: Query Execution and Response Generation

**User Story:** As a business user, I want the system to execute the generated query and return a human-readable answer, so that I receive accurate, data-backed responses.

#### Acceptance Criteria

1. WHEN THE LLM_Service produces a valid Cypher query, THE Query_Engine SHALL execute it against Graph_DB and return the result set.
2. WHEN the Query_Engine returns results, THE LLM_Service SHALL send the result set back to Gemini with a prompt to generate a concise, human-readable natural language answer.
3. THE Graph_API SHALL return the natural language answer in the `POST /query` response body as a JSON object with an `answer` field.
4. IF the Cypher query returns an empty result set, THEN THE LLM_Service SHALL return an answer stating that no matching data was found in the dataset.
5. IF the Query_Engine encounters a Cypher execution error, THEN THE Graph_API SHALL return HTTP 500 with a JSON error body containing a `message` field.
6. THE Graph_API SHALL respond to `POST /query` within 30 seconds under normal operating conditions.

---

### Requirement 8: Query Guardrails

**User Story:** As a product owner, I want the system to reject queries that are unrelated to the O2C dataset, so that the LLM is not misused for general-purpose questions.

#### Acceptance Criteria

1. WHEN a user submits a query, THE Guardrail SHALL classify the query as in-scope if it relates to sales orders, deliveries, billing documents, payments, customers, products, or plants in the dataset.
2. WHEN a user submits a query that is not related to the O2C dataset (e.g., general knowledge, coding questions, personal questions), THE Guardrail SHALL reject the query before it reaches the LLM_Service.
3. WHEN THE Guardrail rejects a query, THE Graph_API SHALL return HTTP 200 with a JSON response containing an `answer` field with a message stating the query is outside the scope of the system.
4. THE Guardrail SHALL evaluate query scope using keyword and intent matching against the known entity types: `BusinessPartner`, `SalesOrder`, `Product`, `Delivery`, `BillingDocument`, `Payment`, `Plant`.
5. IF a query is ambiguous but could plausibly relate to O2C data, THEN THE Guardrail SHALL allow the query to proceed to the LLM_Service rather than reject it.

---

### Requirement 9: JSONL Parser Round-Trip Integrity

**User Story:** As a developer, I want confidence that the JSONL parsing logic correctly handles all data formats in the source files, so that no data is silently lost or corrupted during ingestion.

#### Acceptance Criteria

1. THE Ingestion_Service SHALL parse each JSONL record into a structured JavaScript object with all original fields preserved.
2. WHEN a parsed object is serialized back to JSON and re-parsed, THE Ingestion_Service SHALL produce an object equivalent to the original parsed object (round-trip property).
3. THE Ingestion_Service SHALL handle nested objects (e.g., `creationTime: { hours, minutes, seconds }`) without flattening or dropping fields.
4. THE Ingestion_Service SHALL handle `null` field values without converting them to `undefined` or omitting them from the parsed object.
5. WHEN a numeric string field (e.g., `totalNetAmount: "216.1"`) is parsed, THE Ingestion_Service SHALL preserve the original string representation and not silently coerce it to a float.
