# Implementation Plan: Graph-Based Query System

## Overview

Incremental implementation of the SAP O2C graph system: backend ingestion → Neo4j graph → REST API → LLM query pipeline → React frontend. Each task builds on the previous and ends with all code wired together.

## Tasks

- [x] 1. Project scaffolding and environment setup
  - Initialize `backend/` as a Node.js project: `npm init`, install `express`, `neo4j-driver`, `@google/generative-ai`, `dotenv`, `cors`
  - Initialize `frontend/` as a React app (Vite): install `react-flow-renderer` (or `@xyflow/react`), `tailwindcss`, configure Tailwind
  - Create `backend/.env` referencing `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `GEMINI_API_KEY`; add `.env` to `.gitignore`
  - Create `backend/src/app.js` and `backend/src/server.js` with minimal Express setup and CORS enabled
  - Create directory stubs for all backend modules: `ingestion/`, `ingestion/loaders/`, `graph/`, `llm/`, `query/`, `guardrail/`, `routes/`
  - _Requirements: 1.1, 6.1_

- [x] 2. JSONL parser
  - [x] 2.1 Implement `backend/src/ingestion/jsonlParser.js`
    - Read file line-by-line using Node.js `readline`
    - Skip blank lines; `JSON.parse` each non-blank line
    - On parse error log `{ file, lineNumber, error }` and continue; do not throw
    - Return an async generator or array of parsed objects
    - _Requirements: 1.2, 1.3, 9.1, 9.3, 9.4, 9.5_

  - [ ]* 2.2 Write unit tests for `jsonlParser`
    - Test: valid single-line file returns one object
    - Test: blank lines are skipped
    - Test: malformed JSON logs error and continues without throwing
    - Test: nested objects are preserved without flattening
    - Test: `null` values remain `null` (not `undefined`)
    - Test: numeric string `"216.1"` is not coerced to float
    - _Requirements: 1.2, 1.3, 9.1, 9.3, 9.4, 9.5_

  - [ ]* 2.3 Write property test P1: JSONL Round-Trip Integrity
    - // Feature: graph-based-query-system, Property 1: JSONL Round-Trip Integrity
    - Use fast-check to generate arbitrary JSON objects, serialize to JSONL line, parse, re-serialize, re-parse → assert deep equal
    - Minimum 100 iterations
    - **Property 1: JSONL Round-Trip Integrity**
    - **Validates: Requirements 9.2**

  - [ ]* 2.4 Write property test P2: Null and String Preservation
    - // Feature: graph-based-query-system, Property 2: Null and String Preservation
    - Use fast-check to generate objects with `null` values and numeric-string fields; parse → assert nulls remain `null`, numeric strings remain strings
    - Minimum 100 iterations
    - **Property 2: Null and String Preservation**
    - **Validates: Requirements 9.4, 9.5**

- [x] 3. Neo4j driver and schema constraints
  - [x] 3.1 Implement `backend/src/graph/neo4jDriver.js`
    - Export a singleton Neo4j driver using `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` from env
    - Configure `connectionTimeout: 5000` and `maxTransactionRetryTime: 5000`
    - Export a `closeDriver()` helper for graceful shutdown
    - _Requirements: 3.4_

  - [x] 3.2 Create `backend/src/graph/schemaSetup.js` and run on startup
    - Execute all `CREATE CONSTRAINT IF NOT EXISTS` Cypher statements for `BusinessPartner`, `SalesOrder`, `Product`, `Delivery`, `BillingDocument`, `Plant`
    - Log success or error for each constraint
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.8_

- [x] 4. Entity loaders
  - [x] 4.1 Implement `backend/src/ingestion/loaders/businessPartnerLoader.js`
    - Parse `business_partners` and `business_partner_addresses` files
    - `MERGE (n:BusinessPartner {businessPartner: $id}) SET n += $props` for each record
    - _Requirements: 2.1_

  - [x] 4.2 Implement `backend/src/ingestion/loaders/salesOrderLoader.js`
    - Parse `sales_order_headers` and `sales_order_items`
    - Merge `SalesOrder` nodes keyed on `salesOrder`
    - Merge `SalesOrderItem` nodes keyed on composite `salesOrder_salesOrderItem`
    - Create `CONTAINS` relationships between `SalesOrder` and `SalesOrderItem`
    - _Requirements: 2.2, 2.3, 2.10_

  - [x] 4.3 Implement `backend/src/ingestion/loaders/productLoader.js`
    - Parse `products` and `product_descriptions`
    - Merge `Product` nodes keyed on `material`, enriching with description data
    - _Requirements: 2.4_

  - [x] 4.4 Implement `backend/src/ingestion/loaders/deliveryLoader.js`
    - Parse `outbound_delivery_headers` and `outbound_delivery_items`
    - Merge `Delivery` nodes keyed on `deliveryDocument`
    - _Requirements: 2.5_

  - [x] 4.5 Implement `backend/src/ingestion/loaders/billingDocumentLoader.js`
    - Parse `billing_document_headers`, `billing_document_items`, and `billing_document_cancellations`
    - Merge `BillingDocument` nodes keyed on `billingDocument`
    - _Requirements: 2.6_

  - [x] 4.6 Implement `backend/src/ingestion/loaders/paymentLoader.js`
    - Parse `payments_accounts_receivable`
    - Merge `Payment` nodes keyed on composite `accountingDocument_accountingDocumentItem`
    - _Requirements: 2.7_

  - [x] 4.7 Implement `backend/src/ingestion/loaders/plantLoader.js`
    - Parse `plants`
    - Merge `Plant` nodes keyed on `plant`
    - _Requirements: 2.8_

  - [x] 4.8 Create relationship wiring in each loader (or a dedicated `relationshipLoader.js`)
    - `PLACED_BY`: SalesOrder → BusinessPartner via `soldToParty`
    - `ORDERS`: SalesOrderItem → Product via `material`
    - `FULFILLED_BY`: SalesOrder → Delivery via `referenceSdDocument`
    - `BILLED_AS`: Delivery → BillingDocument via `referenceSdDocument`
    - `CLEARED_BY`: BillingDocument → Payment via `accountingDocument`
    - `PRODUCED_AT`: Product → Plant via `productionPlant` from sales order items
    - All relationships use `MERGE` to remain idempotent
    - _Requirements: 2.9, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16_

- [x] 5. Ingestion service orchestrator
  - Implement `backend/src/ingestion/ingestionService.js`
  - Call loaders in dependency order: plants → products → businessPartners → salesOrders → deliveries → billingDocuments → payments
  - Log start/end and record counts for each loader
  - Export a `runIngestion()` function callable from `server.js` on startup
  - _Requirements: 1.1, 1.4, 1.5_

- [ ] 6. Checkpoint — ingestion pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Graph repository and GET /graph route
  - [x] 7.1 Implement `backend/src/graph/graphRepository.js`
    - `getGraph()`: run `MATCH (n) RETURN n` and `MATCH ()-[r]->() RETURN r` (or a single query)
    - Map each Neo4j node to `{ id, label, properties }` and each relationship to `{ id, source, target, type }`
    - Return `{ nodes, edges }`
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 7.2 Implement `backend/src/routes/graphRoutes.js`
    - `GET /graph` → call `graphRepository.getGraph()`, return JSON
    - On Neo4j error return 503 `{ message: "Database unreachable." }`
    - _Requirements: 3.1, 3.4_

  - [ ]* 7.3 Write unit tests for `graphRepository`
    - Test: Neo4j records are correctly mapped to `{ nodes, edges }` shape
    - Test: node `id`, `label`, and `properties` fields are present
    - Test: edge `id`, `source`, `target`, `type` fields are present
    - _Requirements: 3.2, 3.3_

  - [ ]* 7.4 Write property test P4: Graph API Node and Edge Completeness
    - // Feature: graph-based-query-system, Property 4: Graph API Node and Edge Completeness
    - Use fast-check to generate arbitrary node/edge sets; seed Neo4j (test instance); call `GET /graph`; assert returned counts match seeded counts with no duplicates
    - Minimum 100 iterations
    - **Property 4: Graph API Node and Edge Completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 8. Guardrail module
  - [x] 8.1 Implement `backend/src/guardrail/guardrail.js`
    - Define O2C keyword list: `salesOrder`, `delivery`, `billing`, `payment`, `customer`, `product`, `plant`, `invoice`, `businessPartner`, `order`, `shipment`, `clearingDate`, etc.
    - `classify(query)`: return `{ inScope: boolean }`
    - In-scope if query contains at least one O2C keyword (case-insensitive)
    - Ambiguous queries default to in-scope (per requirement 8.5)
    - Out-of-scope only when no O2C keywords and clear non-O2C intent
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

  - [ ]* 8.2 Write unit tests for `guardrail`
    - Test: known O2C phrases → in-scope
    - Test: "What is the capital of France?" → out-of-scope
    - Test: "Write me a Python script" → out-of-scope
    - Test: ambiguous phrase → in-scope (not rejected)
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

  - [ ]* 8.3 Write property test P5: Guardrail Scope Classification
    - // Feature: graph-based-query-system, Property 5: Guardrail Scope Classification
    - Use fast-check to generate strings composed entirely of O2C keywords → assert in-scope; generate strings from non-O2C vocabulary → assert out-of-scope
    - Minimum 100 iterations
    - **Property 5: Guardrail Scope Classification**
    - **Validates: Requirements 8.1, 8.2, 8.4**

  - [ ]* 8.4 Write property test P6: Out-of-Scope Queries Return HTTP 200 with Answer Field
    - // Feature: graph-based-query-system, Property 6: Out-of-Scope Queries Return HTTP 200 with Answer Field
    - Use fast-check to generate queries that the guardrail rejects; call `POST /query`; assert HTTP 200 and body has `answer` field
    - Minimum 100 iterations
    - **Property 6: Out-of-Scope Queries Return HTTP 200 with Answer Field**
    - **Validates: Requirements 8.3**

- [x] 9. LLM service
  - [x] 9.1 Implement `backend/src/llm/llmService.js`
    - Initialize Gemini client with `process.env.GEMINI_API_KEY`; throw descriptive error on startup if key is missing
    - `generateCypher(query)`: build schema-aware system prompt (node labels, relationship types, key properties), call Gemini, extract Cypher from response using regex/parsing
    - `generateAnswer(query, results)`: call Gemini with result set, return concise NL answer
    - Wrap Gemini calls in `Promise.race` with 30-second timeout; on timeout/error throw with 502 context
    - Do not expose raw Gemini response or system prompt to callers
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.2, 7.4_

  - [ ]* 9.2 Write unit tests for `llmService`
    - Test: Cypher is correctly extracted from a mock Gemini response containing a code block
    - Test: timeout after 30s triggers 502 error
    - Test: missing `GEMINI_API_KEY` throws on module load
    - Test: empty result set returns "no matching data found" answer
    - _Requirements: 6.3, 6.4, 7.4_

- [x] 10. Query engine
  - [x] 10.1 Implement `backend/src/query/queryEngine.js`
    - `executeCypher(cypher)`: open a Neo4j session, run the query, return raw records
    - On Neo4j error throw with 503 context; on Cypher execution error throw with 500 context
    - _Requirements: 7.1, 7.5_

  - [ ]* 10.2 Write unit tests for `queryEngine`
    - Test: valid Cypher returns records array
    - Test: Neo4j connection failure throws 503-tagged error
    - Test: Cypher syntax error throws 500-tagged error
    - _Requirements: 7.1, 7.5_

- [x] 11. Query route and Express app wiring
  - [x] 11.1 Implement `backend/src/routes/queryRoutes.js`
    - `POST /query`: validate `query` field present; call `guardrail.classify()`
    - If out-of-scope: return 200 `{ answer: "This question is outside the scope of the O2C dataset." }`
    - If in-scope: call `llmService.generateCypher()` → `queryEngine.executeCypher()` → `llmService.generateAnswer()` → return 200 `{ answer }`
    - Propagate 502 (LLM error), 503 (DB error), 500 (query error) via Express error middleware
    - _Requirements: 7.3, 8.3, 6.4, 7.5_

  - [x] 11.2 Wire all routes and middleware in `backend/src/app.js`
    - Mount `graphRoutes` at `/graph` and `queryRoutes` at `/query`
    - Add central error middleware that formats errors as `{ message }` and avoids leaking stack traces
    - Call `schemaSetup` and `runIngestion` from `server.js` on startup
    - _Requirements: 3.1, 7.3_

  - [ ]* 11.3 Write property test P7: Query Response Contains Answer Field
    - // Feature: graph-based-query-system, Property 7: Query Response Contains Answer Field
    - Use fast-check to generate in-scope query strings; mock Gemini and Neo4j; call `POST /query`; assert HTTP 200 and `answer` is a non-empty string
    - Minimum 100 iterations
    - **Property 7: Query Response Contains Answer Field**
    - **Validates: Requirements 7.3**

- [ ] 12. Checkpoint — backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Frontend: constants, hooks, and base layout
  - [x] 13.1 Create `frontend/src/constants/nodeColors.js`
    - Export a map of node label → Tailwind color class or hex: `BusinessPartner`, `SalesOrder`, `SalesOrderItem`, `Product`, `Delivery`, `BillingDocument`, `Payment`, `Plant`
    - _Requirements: 4.7_

  - [x] 13.2 Implement `frontend/src/hooks/useGraph.js`
    - Fetch `GET /graph` on mount; return `{ nodes, edges, loading, error }`
    - _Requirements: 4.1, 4.5, 4.6_

  - [x] 13.3 Implement `frontend/src/hooks/useChat.js`
    - Manage conversation history array `[{ role, text }]`
    - `sendMessage(query)`: POST to `/query`, append user message and response to history; set `loading` during request; on network error append error message without clearing history
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [x] 14. Frontend: graph viewer and node panel
  - [x] 14.1 Implement `frontend/src/components/LoadingSpinner.jsx`
    - Simple accessible spinner component used by both GraphViewer and ChatInterface
    - _Requirements: 4.5, 5.3_

  - [x] 14.2 Implement `frontend/src/components/NodePanel.jsx`
    - Receives a selected node object; renders all `properties` as a key-value list
    - Renders nothing (or a placeholder) when no node is selected
    - _Requirements: 4.3_

  - [x] 14.3 Implement `frontend/src/components/GraphViewer.jsx`
    - Use `useGraph` hook to get nodes/edges
    - Transform API nodes/edges to React Flow format; apply colors from `nodeColors.js`
    - Show `LoadingSpinner` while loading; show error message on failure
    - On node click, pass selected node to `NodePanel`
    - Enable pan/zoom via React Flow defaults
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 15. Frontend: chat interface and App wiring
  - [x] 15.1 Implement `frontend/src/components/ChatInterface.jsx`
    - Use `useChat` hook; render conversation history (user + system messages)
    - Text input + submit button; disable button and show `LoadingSpinner` while loading
    - On network error display error message without clearing history
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 15.2 Wire everything in `frontend/src/App.jsx`
    - Render `GraphViewer` and `ChatInterface` side-by-side (or split layout) using Tailwind
    - _Requirements: 4.1, 5.1_

- [ ] 16. Property-based tests: ingestion idempotency
  - [ ]* 16.1 Write property test P3: Ingestion Idempotency
    - // Feature: graph-based-query-system, Property 3: Ingestion Idempotency
    - Use fast-check to generate sets of node records; run `runIngestion()` twice against a test Neo4j instance; assert node and relationship counts are identical after both runs
    - Minimum 100 iterations
    - **Property 3: Ingestion Idempotency**
    - **Validates: Requirements 1.5, 2.16**

- [ ] 17. Integration tests
  - [ ]* 17.1 Write integration test: full ingestion on sample JSONL files
    - Run `runIngestion()` against a test Neo4j instance using a small sample of real JSONL files
    - Assert node counts > 0 for each entity type
    - _Requirements: 1.1, 1.4, 2.1–2.8_

  - [ ]* 17.2 Write integration test: GET /graph returns populated graph
    - After ingestion, call `GET /graph`; assert `nodes.length > 0` and `edges.length > 0`
    - Assert each node has `id`, `label`, `properties`; each edge has `id`, `source`, `target`, `type`
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 17.3 Write integration test: POST /query with known O2C question
    - Send a known O2C question (e.g., "List all sales orders"); assert HTTP 200 and `answer` is a non-empty string
    - _Requirements: 7.3, 6.1_

  - [ ]* 17.4 Write integration test: POST /query with out-of-scope question
    - Send "What is the capital of France?"; assert HTTP 200 and `answer` contains scope rejection message
    - _Requirements: 8.2, 8.3_

- [ ] 18. Final checkpoint — all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. README
  - Create `README.md` at the project root
  - Document: prerequisites (Node.js, Neo4j, Gemini API key), environment variable setup, how to run ingestion, how to start backend and frontend, project structure overview
  - _Requirements: 1.1, 6.1_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check with a minimum of 100 iterations each
- All ingestion writes use Cypher `MERGE` to guarantee idempotency (P3)
- The guardrail runs before any LLM call to prevent misuse (Requirement 8)
