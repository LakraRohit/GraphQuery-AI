import { useState, useEffect } from 'react';

export default function useGraph() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://localhost:3001/graph')
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load graph.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { nodes, edges, loading, error };
}
