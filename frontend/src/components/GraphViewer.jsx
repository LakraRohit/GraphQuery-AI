import React, { useState, useCallback, useEffect } from 'react';
import { ReactFlow, Background, Controls, useReactFlow, ReactFlowProvider, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import useGraph from '../hooks/useGraph';
import nodeColors from '../constants/nodeColors';
import LoadingSpinner from './LoadingSpinner';

function NodePopup({ node, onClose }) {
  const [pos, setPos] = useState({ x: 24, y: 24 });
  const dragging = React.useRef(false);
  const offset = React.useRef({ x: 0, y: 0 });

  const onMouseDown = (e) => {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  if (!node) return null;
  const { label, properties } = node;
  return (
    <div
      className="absolute z-10 bg-white rounded-xl shadow-2xl p-4 w-72 text-xs border border-gray-200"
      style={{ top: pos.y, left: pos.x, cursor: 'grab', userSelect: 'none' }}
      onMouseDown={onMouseDown}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm text-gray-800">{label}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-base leading-none" onMouseDown={e => e.stopPropagation()}>×</button>
      </div>
      <dl className="space-y-1 max-h-64 overflow-y-auto">
        {Object.entries(properties || {}).map(([key, value]) => {
          const display = value === null ? 'null'
            : typeof value === 'object' ? JSON.stringify(value)
            : String(value);
          return (
            <div key={key} className="flex flex-col">
              <dt className="text-gray-400 font-medium capitalize">{key}:</dt>
              <dd className="text-gray-700 break-all">{display}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function DotNode({ data }) {
  const color = nodeColors[data.label] || nodeColors.default;
  const size = data.highlighted ? 150 : data.dimmed ? 100 : 100;
  const opacity = data.dimmed ? 0.5 : 1;
  const border = data.highlighted ? '6px solid #000' : 'none';
  const shadow = data.highlighted ? '0 0 0 40px #00000022' : 'none';
  const handleStyle = { opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: 'none', background: 'transparent' };
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div style={{ width: size, height: size, borderRadius: '50%', background: color, opacity, border, boxShadow: shadow, transition: 'all 0.3s ease', cursor: 'pointer' }} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
}

const nodeTypes = { dot: DotNode };

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function GraphCanvas({ apiNodes, apiEdges, highlightedNodeIds, directMatchIds, onNodeClick }) {
  const { fitView } = useReactFlow();

  const positionsRef = React.useRef(null);
  if (!positionsRef.current && apiNodes.length > 0) {
    const rand = seededRandom(42);
    const spread = Math.max(2000, apiNodes.length * 25);
    positionsRef.current = {};
    apiNodes.forEach((node) => {
      positionsRef.current[node.id] = { x: rand() * spread, y: rand() * spread };
    });
  }
  const positions = positionsRef.current || {};

  const flowNodes = apiNodes.map((node) => {
    const isHighlighted = highlightedNodeIds.size > 0 && highlightedNodeIds.has(node.id);
    const isDimmed = highlightedNodeIds.size > 0 && !highlightedNodeIds.has(node.id);
    return {
      id: node.id,
      type: 'dot',
      data: { label: node.label, properties: node.properties, highlighted: isHighlighted, dimmed: isDimmed },
      position: positions[node.id] || { x: 0, y: 0 },
    };
  });

  const flowEdges = apiEdges.map((edge) => {
    const srcDirect = directMatchIds.size > 0 && directMatchIds.has(edge.source);
    const tgtDirect = directMatchIds.size > 0 && directMatchIds.has(edge.target);
    const srcNeighbor = highlightedNodeIds.has(edge.source);
    const tgtNeighbor = highlightedNodeIds.has(edge.target);
    // Black when at least one endpoint is a direct match
    const isHighlighted = srcDirect || tgtDirect;
    // Dim edges with no connection to highlighted subgraph
    const isDimmed = highlightedNodeIds.size > 0 && !srcNeighbor && !tgtNeighbor;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'default',
      style: { stroke: isHighlighted ? '#000000' : '#60a5fa', strokeWidth: isHighlighted ? 8 : 1.8, opacity: isDimmed ? 0.4 : 0.85, transition: 'all 0.3s ease' },
      animated: isHighlighted,
    };
  });

  useEffect(() => {
    if (!highlightedNodeIds.size) {
      setTimeout(() => fitView({ duration: 400, padding: 0.08 }), 50);
    }
    // When highlighting, do NOT auto-pan — let user navigate freely
  }, [highlightedNodeIds]);

  return (
    <ReactFlow nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} onNodeClick={onNodeClick} fitView minZoom={0.01} maxZoom={4} proOptions={{ hideAttribution: true }}>
      <Background color="#e2e8f0" gap={32} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

const LABEL_HINTS = {
  Product: ['product', 'material', 'perfume', 'facewash', 'charcoal', 'bodyspray', 'hairwax', 'beardoil', 'bodywash', 'shampoo', 'lipbalm', 'edt', 'edp', 'serum', 'moisturiser', 'sunscreen', 'details', 'item'],
  SalesOrder: ['order', 'sales'],
  BusinessPartner: ['customer', 'partner', 'client'],
  BillingDocument: ['billing', 'invoice'],
  Payment: ['payment', 'paid', 'clearing'],
  Delivery: ['delivery', 'delivered', 'shipment'],
};
const LABEL_PRIORITY = ['Product', 'SalesOrder', 'BusinessPartner', 'BillingDocument', 'Payment', 'Delivery', 'SalesOrderItem', 'Plant'];

export default function GraphViewer({ lastQuery }) {
  const { nodes: apiNodes, edges: apiEdges, loading, error } = useGraph();
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState(new Set());
  const [directMatchIds, setDirectMatchIds] = useState(new Set());

  useEffect(() => {
    if (!lastQuery || !apiNodes.length) {
      setHighlightedNodeIds(new Set());
      setDirectMatchIds(new Set());
      setSelectedNode(null);
      return;
    }

    const queryLower = lastQuery.toLowerCase();
    const tokens = queryLower.split(/\s+/).filter(w => w.length > 1);
    const ids = (lastQuery.match(/[a-zA-Z0-9]{6,}/g) || []).map(s => s.toLowerCase());
    const keywords = [...new Set([...tokens, ...ids])];

    // Find direct matches — nodes whose properties contain any keyword
    const directMatches = new Set();
    apiNodes.forEach((node) => {
      const haystack = JSON.stringify(node.properties).toLowerCase();
      if (keywords.some(kw => haystack.includes(kw))) {
        directMatches.add(node.id);
      }
    });

    // For exact ID matches, restrict directMatches to only the primary node type
    // This prevents SalesOrderItem nodes (which also store material IDs) from being treated as direct matches
    const exactMatchNode = (() => {
      for (const id of ids) {
        for (const label of LABEL_PRIORITY) {
          const exact = apiNodes.find(n =>
            n.label === label &&
            Object.values(n.properties).some(v => String(v).toLowerCase() === id)
          );
          if (exact) return exact;
        }
      }
      return null;
    })();

    // If we found an exact match, restrict directMatches to just that node
    // so only it gets the black border + black edges treatment
    const strictDirectMatches = exactMatchNode
      ? new Set([exactMatchNode.id])
      : directMatches;

    // Expand to neighbors using strictDirectMatches
    const matched = new Set(strictDirectMatches);
    apiEdges.forEach((edge) => {
      if (strictDirectMatches.has(edge.source)) matched.add(edge.target);
      if (strictDirectMatches.has(edge.target)) matched.add(edge.source);
    });

    setHighlightedNodeIds(matched);
    setDirectMatchIds(strictDirectMatches);

    // Find best popup node — use exactMatchNode if found
    let bestNode = exactMatchNode;

    // If no exact match, try label hint
    if (!bestNode) {
      for (const label of LABEL_PRIORITY) {
        const hints = LABEL_HINTS[label] || [];
        if (hints.some(h => queryLower.includes(h))) {
          const candidate = apiNodes.find(n => strictDirectMatches.has(n.id) && n.label === label);
          if (candidate) { bestNode = candidate; break; }
        }
      }
    }
    const isAggregation = /\b(how many|total|count|list all|show all|all products|all orders|all customers)\b/i.test(lastQuery);
    if (isAggregation) bestNode = null;

    setSelectedNode(bestNode ? { id: bestNode.id, label: bestNode.label, properties: bestNode.properties } : null);

  }, [lastQuery, apiNodes, apiEdges]);

  const onNodeClick = useCallback((_event, node) => {
    setSelectedNode({ id: node.id, ...node.data });
  }, []);

  if (loading) return <div className="flex-1 flex items-center justify-center bg-gray-50"><LoadingSpinner /></div>;
  if (error) return <div className="flex-1 flex items-center justify-center text-red-400 text-sm bg-gray-50">{error}</div>;

  return (
    <div className="relative h-full w-full bg-gray-50">
      <ReactFlowProvider>
        <GraphCanvas apiNodes={apiNodes} apiEdges={apiEdges} highlightedNodeIds={highlightedNodeIds} directMatchIds={directMatchIds} onNodeClick={onNodeClick} />
      </ReactFlowProvider>
      <NodePopup node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
}
