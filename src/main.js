import { onAuthChange } from './firebase.js';
import { renderCatalog } from './pages/catalog.js';
import { renderViewer } from './pages/viewer.js';
import { renderAdmin } from './pages/admin.js';
import { installCopyrightGuard } from './components/copyright-guard.js';

const app = document.getElementById('app');

// 저작권 보호 설치
installCopyrightGuard();

// 인증 상태 감시
onAuthChange((user) => {
  window.__currentUser = user;
});

// Hash 기반 SPA 라우터
function router() {
  const hash = window.location.hash.slice(1) || 'catalog';
  const [path, queryStr] = hash.split('?');
  const params = new URLSearchParams(queryStr || '');

  app.innerHTML = '';

  switch (path) {
    case 'viewer':
      renderViewer(app, params);
      break;
    case 'admin':
      renderAdmin(app, params);
      break;
    case 'catalog':
    default:
      renderCatalog(app, params);
      break;
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
