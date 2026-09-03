import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/theme.css';
// Order matters: these extend/override selectors already defined in theme.css (e.g. the
// auth-card responsive rules), so they must load after it to preserve the original cascade.
import './styles/auth.css';
import './styles/landing.css';
import './styles/student-portal.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
