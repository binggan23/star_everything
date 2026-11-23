import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { createCollectionRepository } from './data/collectionRepository';
import { createTauriSqlDriver } from './data/tauriSqlDriver';
import './styles.css';

const repository = createCollectionRepository(createTauriSqlDriver());

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App repository={repository} />
  </StrictMode>,
);
