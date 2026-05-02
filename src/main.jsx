import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: Register Service Worker
if ('serviceWorker' in navigator) {
  const swPath = import.meta.env.BASE_URL + 'sw.js';
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swPath).catch(() => {});
  });
}
