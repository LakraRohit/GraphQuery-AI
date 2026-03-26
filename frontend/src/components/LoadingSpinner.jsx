import React from 'react';

export default function LoadingSpinner({ className = '' }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin ${className}`}
    />
  );
}
