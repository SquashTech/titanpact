import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './registerServiceWorker';
import { initSfx } from '../audio/sfx';
import { installUiSfx } from '../audio/uiSfx';
import './styles.css';

// Audio is presentation, so it installs alongside the view and never from
// the engine. Both calls are inert until the first user gesture unlocks the
// AudioContext (browsers require that), so running them at import time is safe.
initSfx();
installUiSfx();

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing from index.html');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

registerServiceWorker();
