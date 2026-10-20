import { createRoot } from 'react-dom/client';
import App from './App';
import './i18n';
import './styles.css';
import { initTelemetry } from './lib/telemetry';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
const boot = document.getElementById('boot');
if (boot) {
  window.setTimeout(() => boot.remove(), 350);
}

initTelemetry();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline caching unavailable */
    });
  });
}
