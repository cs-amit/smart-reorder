import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary.tsx';
import {ConfigWarningBanner} from './components/ConfigWarningBanner.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigWarningBanner />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
