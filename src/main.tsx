import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { requestPersistence } from './lib/storage';
import './styles.css';

// Požádáme prohlížeč o trvalé úložiště, aby data aplikace sám nemazal.
void requestPersistence();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
