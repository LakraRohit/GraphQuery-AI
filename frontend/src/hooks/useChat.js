import { useState } from 'react';

export default function useChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastQuery, setLastQuery] = useState('');

  async function sendMessage(query) {
    setMessages((prev) => [...prev, { role: 'user', text: query }]);
    setLastQuery(query);
    setLoading(true);
    try {
      const res = await fetch('https://graphquery-ai-production.up.railway.app/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'system', text: data.answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'system', text: 'Error: could not reach the server.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return { messages, loading, sendMessage, lastQuery };
}
