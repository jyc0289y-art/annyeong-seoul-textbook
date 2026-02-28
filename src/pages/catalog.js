import { BOOKS, CATEGORIES } from '../config/books.js';
import { getCurrentUser, loginWithGoogle, loginWithApple, logout } from '../firebase.js';

let activeCategory = 'all';

export function renderCatalog(container) {
  const user = getCurrentUser();

  container.innerHTML = `
    <header class="site-header">
      <div class="logo"><span>SeouLink</span> | 안녕, 서울</div>
      <div class="nav-actions">
        ${user
          ? `<span style="color:var(--text-secondary);font-size:0.85rem">${user.displayName || user.email}</span>
             <button class="btn btn-ghost" id="logout-btn">로그아웃</button>`
          : `<button class="btn btn-primary" id="login-btn">로그인</button>`
        }
      </div>
    </header>

    <div class="catalog-container">
      <div class="catalog-hero">
        <h1>안녕, 서울</h1>
        <p>SeouLink Korean Language Textbook Series</p>
      </div>

      <div class="category-tabs" id="category-tabs"></div>
      <div class="book-grid" id="book-grid"></div>
    </div>

    <footer class="site-footer">
      &copy; ${new Date().getFullYear()} SL Corporation. All rights reserved.
      교재의 무단 복제 및 배포를 금지합니다.
    </footer>
  `;

  renderCategories();
  renderBooks();
  bindEvents(container);
}

function renderCategories() {
  const tabs = document.getElementById('category-tabs');
  tabs.innerHTML = CATEGORIES.map(cat => `
    <button class="category-tab ${cat.id === activeCategory ? 'active' : ''}"
            data-category="${cat.id}">
      ${cat.label_ko}
    </button>
  `).join('');

  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-tab');
    if (!btn) return;
    activeCategory = btn.dataset.category;
    tabs.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    renderBooks();
  });
}

function renderBooks() {
  const grid = document.getElementById('book-grid');
  const filtered = activeCategory === 'all'
    ? BOOKS
    : BOOKS.filter(b => b.category === activeCategory);

  grid.innerHTML = filtered.map(book => `
    <div class="book-card" data-book-id="${book.id}">
      <div class="book-card-cover" style="background: linear-gradient(135deg, ${book.color}, ${book.color}88)">
        ${book.cefr}
      </div>
      <div class="book-card-body">
        <h3>${book.title_ko}</h3>
        <span class="cefr">${book.cefr}</span>
        <p class="desc">${book.description_ko}</p>
      </div>
      <div class="book-card-footer">
        <span class="preview-badge">미리보기 ${book.previewPages}p</span>
        <span class="open-btn">열기 &rarr;</span>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.hash = `#viewer?book=${card.dataset.bookId}`;
    });
  });
}

function bindEvents(container) {
  const loginBtn = container.querySelector('#login-btn');
  const logoutBtn = container.querySelector('#logout-btn');

  if (loginBtn) {
    loginBtn.addEventListener('click', () => showLoginModal(container));
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logout();
      renderCatalog(container);
    });
  }
}

function showLoginModal(container) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>로그인</h2>
      <p>교재를 열람하려면 로그인이 필요합니다.<br>
         ログインが必要です。</p>
      <div class="modal-actions">
        <button class="btn-google" id="google-login">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#fff" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#fff" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/></svg>
          Google로 로그인
        </button>
        <button class="btn-apple" id="apple-login">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#fff" d="M14.94 9.88c-.02-2.08 1.7-3.08 1.78-3.13-0.97-1.42-2.48-1.61-3.01-1.63-1.28-.13-2.5.75-3.15.75-.65 0-1.65-.73-2.71-.71-1.4.02-2.68.81-3.4 2.06-1.45 2.51-.37 6.24 1.04 8.28.69 1 1.51 2.12 2.59 2.08 1.04-.04 1.43-.67 2.69-.67 1.25 0 1.61.67 2.7.65 1.12-.02 1.82-.1.02 2.51-1.04.73-2.63.73-3.54 0-.91-.73z"/></svg>
          Apple로 로그인
        </button>
      </div>
      <p style="margin-top:16px;font-size:0.75rem;color:var(--text-muted)">
        로그인 시 <a href="#" style="color:var(--accent-cyan)">이용약관</a> 및
        <a href="#" style="color:var(--accent-cyan)">개인정보처리방침</a>에 동의합니다.
      </p>
    </div>
  `;

  container.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('#google-login').addEventListener('click', async () => {
    try {
      await loginWithGoogle();
      overlay.remove();
      renderCatalog(document.getElementById('app'));
    } catch (err) {
      console.error('Google login error:', err);
    }
  });

  overlay.querySelector('#apple-login').addEventListener('click', async () => {
    try {
      await loginWithApple();
      overlay.remove();
      renderCatalog(document.getElementById('app'));
    } catch (err) {
      console.error('Apple login error:', err);
    }
  });
}
