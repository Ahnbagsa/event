import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './ui/App';
import { requestPersistentStorage } from './db/persist';
import './index.css';

// 앱을 열자마자 저장 보호를 요청해 둔다. 거절당해도 앱은 그대로 동작하므로
// 결과를 기다리지 않는다.
void requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
