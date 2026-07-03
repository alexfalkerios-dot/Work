import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './Work.jsx';
import './index.css';

// Mock window.storage for local dev (localStorage-backed)
if (!window.storage) {
  window.storage = {
    get: async (key) => {
      const value = localStorage.getItem(key);
      return value !== null ? { value } : null;
    },
    set: async (key, value) => {
      localStorage.setItem(key, value);
      return true;
    },
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
