# SAP O2C Graph-Based Query System

An interactive graph visualization and natural-language query interface over SAP Order-to-Cash (O2C) business data. Users can explore the full O2C process graph and ask plain-English questions that get translated into Cypher queries, executed against Neo4j, and answered in natural language.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, @xyflow/react (React Flow) |
| Backend | Node.js, Express |
| Database | Neo4j 5.x |
| LLM | Groq API (llama-3.3-70b-versatile) |
| Data | SAP O2C JSONL files (19 entity types) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Frontend                        │
│  React Flow Graph Viewer  │  Chat Interface         │
└──────────────┬────────────┴──────────┬──────────────┘
               │ GET /graph            │ POST /query
┌──────────────▼───────────────────────▼──────────────┐
│                  Express Backend                     │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │Guardrail │→ │LLM Service│→ │  Query Engine    │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│                                        │             │
│  ┌─────────────────────────────────────▼──────────┐ │
│  │           Ingestion Service                     │ │
│  │  JSONL Parser → Entity Loaders → Relationships │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │         Neo4j           │
              │   Property Graph DB     │
              └─────────────────────────┘
```

**Query pipeline:** User input → Guardrail → Groq (NL→Cypher) → Neo4j → Groq (results→NL) → User

---

## Architecture Decisions

### Why Neo4j?

The SAP O2C process is inherently a graph: Sales Orders connect to Customers, Deliveries, Billing Documents, and Payments through typed relationships. Relational databases require expensive multi-table JOINs to traverse these chains. Neo4j stores and queries these relationships natively, making multi-hop traversals like `SalesOrder → Delivery → BillingDocument → Payment` fast and natural to express in Cypher.

Key benefits for this use case:
- Native relationship traversal without JOIN overhead
- Cypher query language maps directly to business process questions
- `OPTIONAL MATCH` enables incomplete flow detection (e.g. delivered but not billed)
- Property graph model preserves all entity metadata alongside relationships

### Graph Schema

```
(BusinessPartner) <-[:PLACED_BY]- (SalesOrder)
(SalesOrder) -[:CONTAINS]-> (SalesOrderItem)
(SalesOrderItem) -[:ORDERS]-> (Product)
(SalesOrderItem) -[:PRODUCED_AT]-> (Plant)
(SalesOrder) -[:FULFILLED_BY]-> (Delivery)
(Delivery) -[:BILLED_AS]-> (BillingDocument)
(BillingDocument) -[:CLEARED_BY]-> (Payment)
```

8 node types, 7 relationship types, all ingested from 19 JSONL source files.

### Why Groq (llama-3.3-70b-versatile)?

Originally designed for Google Gemini, the system was migrated to Groq due to free-tier quota restrictions on Gemini in certain regions. Groq provides:
- 14,400 free requests/day, 6,000 tokens/minute
- Fast inference (llama-3.3-70b runs at ~200 tokens/sec on Groq)
- OpenAI-compatible chat completions API

The LLM service is abstracted in `backend/src/llm/llmService.js` — swapping providers requires changing only the client initialization and model name.

---

## LLM Prompting Strategy

The system uses a **two-pass LLM approach**:

### Pass 1 — NL → Cypher

The system prompt includes:
1. Full graph schema (all node labels, properties, and relationship types)
2. Critical rules (e.g. all numeric fields are strings — always use `toFloat()`)
3. Example Cypher queries covering common O2C patterns

```
System: You are a Neo4j Cypher expert. [schema] [rules] [examples]
User: Which products are associated with the highest number of billing documents?
→ LLM returns: MATCH (p:Product)<-[:ORDERS]-(soi:SalesOrderItem)...
```

Key prompt engineering decisions:
- `temperature: 0` for deterministic Cypher generation
- Explicit instruction: "Return ONLY raw Cypher, no markdown, no explanation"
- `stripMarkdownFences()` post-processing to clean any code fences the LLM adds
- Example queries teach the LLM multi-hop paths it wouldn't infer from schema alone
- Explicit `toFloat()` rule prevents SUM returning 0 on string-typed numeric fields

### Pass 2 — Results → Natural Language

```
System: You are a helpful business analyst. Answer based only on provided data.
User: Based on this data: [...results...] Answer: Which products have most billing docs?
→ LLM returns: "The top product is BEARDOIL 30ML with 47 billing documents..."
```

- `temperature: 0.3` for slightly more natural phrasing
- Results truncated to 2000 chars to stay within token limits
- Empty results short-circuit to "No matching data found" without calling the LLM

---

## Guardrails

The guardrail (`backend/src/guardrail/guardrail.js`) runs **before** any LLM call to prevent misuse.

### Classification Logic

A query is classified as **in-scope** if it:
1. Contains any O2C domain keyword (salesorder, delivery, billing, payment, customer, product, plant, invoice, accounting, journal, document, etc.)
2. Contains a numeric document ID (6+ digits) — e.g. `90504248`, `740506`
3. Contains an alphanumeric product/order code — e.g. `S8907367001003`

A query is classified as **out-of-scope** only when none of the above match.

### Behavior

| Query | Classification | Response |
|-------|---------------|----------|
| "Which customer has most orders?" | In-scope | Processed normally |
| "90504248 - find journal entry" | In-scope (numeric ID) | Processed normally |
| "What is the capital of France?" | Out-of-scope | "This system is designed to answer dataset-related queries only." |
| "Write me a Python script" | Out-of-scope | Rejected |

Ambiguous queries default to **in-scope** — it's better to attempt an answer than to incorrectly reject a valid business question.

---

## Prerequisites

- Node.js 18+
- Neo4j 5.x (local or [AuraDB](https://neo4j.com/cloud/platform/aura-graph-database/))
- Groq API key (free at [console.groq.com](https://console.groq.com))

---

## Environment Setup

Create `backend/.env`:

```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
GROQ_API_KEY=your_groq_api_key
PORT=3001
```

---

## Installation & Running

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start backend (auto-runs schema setup + data ingestion on startup)
cd backend && node src/server.js

# Start frontend
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/graph` | Returns `{ nodes, edges }` for the full O2C graph |
| `POST` | `/query` | Accepts `{ query: string }`, returns `{ answer: string }` |

---

## Sample Queries

```
Show details for product S8907367001003
What is the journal entry number for billing document 90504248?
Which products are associated with the highest number of billing documents?
Trace the full flow of billing document 90628265
Identify sales orders that have been delivered but not billed
Which customer has placed the most sales orders?
What is the total net amount for BEARDOIL orders?
```
