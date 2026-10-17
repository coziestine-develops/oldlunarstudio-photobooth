import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import './components/booth-ui.css';
import './components/mobile-layout.css';   // mobile 4:5 camera + tight spacing (after every component stylesheet)
import './tailwind.css';   // last on purpose: utilities override component CSS on equal specificity

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
);