import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './registerServiceWorker';
import { captureInstallPrompt } from './installPrompt';
import { initSfx } from '../audio/sfx';
import { installUiSfx } from '../audio/uiSfx';
import './styles.css';

// Audio is presentation; both are inert until the first user gesture unlocks the AudioContext.
initSfx();
installUiSfx();
// Before the first render: Android can offer its install dialog before React mounts.
captureInstallPrompt();

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing from index.html');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

registerServiceWorker();
