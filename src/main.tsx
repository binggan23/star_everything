import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { createCollectionRepository } from './data/collectionRepository';
import { createFetchPageFetcher } from './data/publicPageFetcher';
import { createTauriSqlDriver } from './data/tauriSqlDriver';
import { createMetadataRecognizer } from './domain/metadata';
import './styles.css';

const repository = createCollectionRepository(createTauriSqlDriver());
const recognizer = createMetadataRecognizer(createFetchPageFetcher());

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App repository={repository} recognizer={recognizer} />
  </StrictMode>,
);
