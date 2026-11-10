import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadDisplayFont } from './fonts';
import './styles/globals.css';
import './styles/board.css';
import './styles/animations.css';

void loadDisplayFont();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
