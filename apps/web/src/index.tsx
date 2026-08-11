import { NuqsAdapter } from 'nuqs/adapters/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app';
import { AuthProvider } from './auth/auth-context';

import '@mantine/charts/styles.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';

const root = document.getElementById('root');

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error('Root element not found.');
}

ReactDOM.createRoot(root!).render(
  <React.StrictMode>
    <NuqsAdapter>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </NuqsAdapter>
  </React.StrictMode>
);
