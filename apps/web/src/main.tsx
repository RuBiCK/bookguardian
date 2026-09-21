import { onlineManager } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { initI18n } from './i18n';
import { listenForInstallPrompt } from './lib/install';
import { setupQueryPersistence } from './lib/persist';
import { createQueryClient } from './lib/query-client';
import { applyTheme, readTheme } from './theme/useTheme';
import './theme/base.css';

initI18n();
applyTheme(readTheme());
listenForInstallPrompt();
// TanStack only learns about connectivity from online/offline events; an app
// launched while already offline (the service worker serves the shell) has
// to be told, or the offline banner would never show.
onlineManager.setOnline(navigator.onLine);
registerSW({ immediate: true });

const container = document.getElementById('root');
if (!container) throw new Error('#root element missing');

// The saved server state is restored before the first screen renders, so the
// library opens offline (and, online, without a flash of skeletons).
const queryClient = createQueryClient();
void setupQueryPersistence(queryClient, __APP_VERSION__).finally(() => {
  createRoot(container).render(
    <StrictMode>
      <App queryClient={queryClient} />
    </StrictMode>,
  );
});
