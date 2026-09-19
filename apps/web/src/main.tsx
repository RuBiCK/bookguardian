import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { initI18n } from './i18n';
import { applyTheme, readTheme } from './theme/useTheme';
import './theme/base.css';

initI18n();
applyTheme(readTheme());
registerSW({ immediate: true });

const container = document.getElementById('root');
if (!container) throw new Error('#root element missing');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
