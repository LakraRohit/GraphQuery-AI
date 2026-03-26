import React from 'react';
import GraphViewer from './components/GraphViewer';
import ChatInterface from './components/ChatInterface';
import useChat from './hooks/useChat';

function App() {
  const { messages, loading, sendMessage, lastQuery } = useChat();

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-gray-900 text-white px-6 py-3 text-lg font-semibold shrink-0">
        Dodge AI Graph Query System
      </header>
      <main className="flex flex-row flex-1 min-h-0">
        <div className="flex-1 min-h-0">
          <GraphViewer lastQuery={lastQuery} />
        </div>
        <div className="w-96 border-l border-gray-200 flex flex-col min-h-0">
          <ChatInterface messages={messages} loading={loading} sendMessage={sendMessage} />
        </div>
      </main>
    </div>
  );
}

export default App;
