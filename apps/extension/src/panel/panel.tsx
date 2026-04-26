import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { TooltipProvider } from './ui/tooltip';
import './styles/globals.css';

document.documentElement.classList.add('dark');

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
