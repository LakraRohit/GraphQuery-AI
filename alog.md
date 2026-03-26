# Project Activity Log — Graph-Based Query System

---

## Session 1 — March 25, 2026

### Spec Creation
- Created requirements document: `.kiro/specs/graph-based-query-system/requirements.md`
  - 9 requirements covering: JSONL ingestion, graph construction, graph API, visualization, chat interface, NL→Cypher translation, query execution, guardrails, parser integrity
- Created design document: `.kiro/specs/graph-based-query-system/design.md`
  - Three-tier architecture (React → Express → Neo4j)
  - 8 node types, 7 relationship types, full join key mapping
  - 7 correctness properties for property-based testing
- Created implementation plan: `.kiro/specs/graph-based-query-system/tasks.md`
  - 19 top-level tasks, full coverage from scaffolding to README

### Task Execution Log

#### Task 1 — Project scaffolding and environment setup ✅
- Created `backend/package.json` (express, neo4j-driver, @google/generative-ai, dotenv, cors, jest, fast-check, supertest)
- Created `frontend/package.json` (react, react-dom, @xyflow/react, tailwindcss, vite, @vitejs/plugin-react)
- Created `backend/.env.example` with env var placeholders
- Created `backend/src/app.js` and `backend/src/server.js`
- Created all backend module directory stubs
- Created `frontend/index.html`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`
- Created `frontend/src/main.jsx` and `frontend/src/App.jsx`
- Created root `.gitignore`

#### Task 2.1 — JSONL parser ✅
- `backend/src/ingestion/jsonlParser.js`: async generator + convenience array function, preserves all types

#### Task 3 — Neo4j driver and schema ✅
- `backend/src/graph/neo4jDriver.js`: singleton driver with getDriver/closeDriver
- `backend/src/graph/schemaSetup.js`: 8 CONSTRAINT IF NOT EXISTS statements
- `backend/src/server.js`: calls runSchemaSetup() on startup

#### Task 4 — Entity loaders ✅
- businessPartnerLoader.js, salesOrderLoader.js, productLoader.js, deliveryLoader.js
- billingDocumentLoader.js, paymentLoader.js, plantLoader.js
- relationshipLoader.js: 7 relationships (PLACED_BY, CONTAINS, ORDERS, FULFILLED_BY, BILLED_AS, CLEARED_BY, PRODUCED_AT)
- All use MERGE for idempotency, batch size 100

#### Task 5 — Ingestion orchestrator ✅
- `backend/src/ingestion/ingestionService.js`: runIngestion() calls loaders in dependency order with timing logs
- server.js updated to call runIngestion() after schema setup

#### Tasks 7–11 — Backend API ✅
- graphRepository.js: getGraph() returns {nodes, edges}
- graphRoutes.js: GET /graph with 503 on DB error
- guardrail.js: keyword-based O2C scope classifier
- llmService.js: generateCypher() + generateAnswer() with 30s timeout, Gemini 1.5 Flash
- queryEngine.js: executeCypher() with 503/500 error tagging
- queryRoutes.js: POST /query full pipeline
- app.js: routes mounted, central error middleware

#### Tasks 13–15 — Frontend ✅
- nodeColors.js: 8 node type colors
- useGraph.js, useChat.js: data fetching hooks
- LoadingSpinner.jsx, NodePanel.jsx, GraphViewer.jsx, ChatInterface.jsx
- App.jsx: dark header + split layout (graph left, chat right)

#### Task 19 — README ✅
- README.md created at project root


---

## Session 2 — Debugging, Iteration & Tool Usage Log

### Tools Used

| Tool | Purpose |
|------|---------|
| `fsWrite` / `strReplace` | Creating and editing source files |
| `readFile` / `readMultipleFiles` | Reading JSONL data samples to extract real field names before writing loaders |
| `readCode` | Inspecting backend module structure |
| `getDiagnostics` | Validating JSX/JS syntax after every edit without running the server |
| `grepSearch` | Finding exact strings in files before replacement |
| `listDirectory` | Discovering actual JSONL file names (e.g. outbound_delivery_items had different filenames than expected) |
| `executePwsh` | Running `npm install groq-sdk` after switching LLM providers |
| `invokeSubAgent` | Delegating spec creation phases (requirements, design, tasks) to specialized subagents |
| `taskStatus` | Tracking task progress through the implementation plan |

---

### Key Workflows & Prompts

#### 1. JSONL Field Name Discovery
Before writing entity loaders, read actual JSONL samples to get real field names:
```
readMultipleFiles([
  "sap-o2c-data/business_partners/...",
  "sap-o2c-data/sales_order_headers/...",
  ...
])
```
This prevented mismatches like `product` vs `material` (products file uses `product` as key, but graph node uses `material`).

#### 2. LLM Provider Migration (Gemini → Groq)
- Initial implementation used `@google/generative-ai` (old SDK)
- Upgraded to `@google/genai` v1.46 — still hit 404 on model names
- Root cause: free tier quota `limit: 0` for `gemini-2.0-flash` in India region
- Migrated to Groq (`groq-sdk`) with `llama-3.3-70b-versatile`
- Required: `npm uninstall @google/generative-ai`, `npm install groq-sdk`, full rewrite of `llmService.js`

#### 3. Cypher Generation Debugging
Problem: `SUM(soi.netAmount)` returned 0 because all numeric fields are stored as strings in Neo4j.

Fix: Added explicit rule to system prompt:
```
ALL numeric fields are stored as STRINGS. Always use toFloat():
SUM(toFloat(soi.netAmount))
```

Problem: Multi-hop queries (Product → BillingDocument) returned no data because Groq didn't know the path.

Fix: Added example Cypher queries to the system prompt showing the full path:
```cypher
MATCH (p:Product)<-[:ORDERS]-(soi:SalesOrderItem)<-[:CONTAINS]-(so:SalesOrder)
      -[:FULFILLED_BY]->(d:Delivery)-[:BILLED_AS]->(bd:BillingDocument)
```

#### 4. Graph Highlighting Iteration
Multiple iterations to fix node/edge highlighting:

- **Iteration 1**: Used circular layout → looked like a ring, not a spider web
- **Iteration 2**: Switched to seeded random layout — stable positions, no re-render jitter
- **Iteration 3**: Custom `DotNode` component without `Handle` → edges didn't render (React Flow requires handles)
- **Iteration 4**: Added hidden handles (opacity:0) → edges appeared
- **Iteration 5**: Highlight logic ran on every render, recalculating positions → highlights reset on state change
- **Fix**: Cached positions in `useRef`, separated position calculation from highlight state
- **Iteration 6**: All nodes turned black-bordered because product ID `S8907367001003` appeared in SalesOrderItem `material` fields too
- **Fix**: Introduced `strictDirectMatches` — only the exact Product node (label=Product, property value exact match) gets black border treatment

#### 5. Guardrail Tuning
Initial keyword list was too narrow — rejected valid queries like:
- `91150187 - find the journal entry number linked to this` (no O2C keywords, just a number)

Fix: Added numeric ID pattern check:
```js
if (/\d{6,}/.test(query)) return { inScope: true };
```

Also added: `journal`, `document`, `transaction`, `find`, `show`, `list` to keyword list.

---

### Debugging Iterations Summary

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Gemini 404 errors | Old SDK (`@google/generative-ai`) used deprecated model names | Upgraded to `@google/genai` v1.46 |
| Gemini 429 quota errors | Free tier `limit: 0` in India region | Migrated to Groq |
| SUM() returning 0 | Numeric fields stored as strings in Neo4j | Added `toFloat()` rule to LLM prompt |
| Multi-hop queries returning no data | LLM didn't know the graph traversal path | Added example Cypher queries to system prompt |
| Edges not rendering | React Flow custom nodes need `Handle` components | Added hidden handles (opacity:0) |
| All nodes highlighted on product query | Product ID appears in SalesOrderItem.material too | `strictDirectMatches` — exact label+value match only |
| Wrong popup node shown | First match in array, not most relevant | Priority-based selection: exact ID match → label hint → fallback |
| Guardrail rejecting document ID queries | No O2C keywords in numeric-only queries | Added regex check for 6+ digit numbers |
| Graph panning too aggressively on highlight | `fitView` zoomed into highlighted subset | Removed fitView on highlight; only fitView on clear |
| Node border showing as 40px solid (too thick) | Typo: `40px` instead of `4px` in border style | Fixed to `6px solid #000` with `box-shadow` glow ring |
