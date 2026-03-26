import React from 'react';

export default function NodePanel({ selectedNode }) {
  if (!selectedNode) {
    return (
      <div className="w-72 h-full bg-white shadow rounded p-4 flex items-center justify-center text-gray-400 text-sm">
        Click a node to see details
      </div>
    );
  }

  const { label, properties } = selectedNode;

  return (
    <div className="w-72 h-full bg-white shadow rounded p-4 overflow-y-auto">
      <h2 className="text-base font-semibold text-gray-800 mb-3">{label}</h2>
      <dl className="space-y-1">
        {Object.entries(properties || {}).map(([key, value]) => {
          let display;
          if (value === null) {
            display = 'null';
          } else if (typeof value === 'object') {
            display = JSON.stringify(value);
          } else {
            display = String(value);
          }
          return (
            <div key={key} className="flex flex-col">
              <dt className="text-xs font-medium text-gray-500">{key}</dt>
              <dd className="text-xs text-gray-800 break-all">{display}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
