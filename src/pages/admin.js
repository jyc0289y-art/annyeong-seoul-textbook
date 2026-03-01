/**
 * 관리자 로그인 및 패널 페이지
 * 라우트: #admin
 */
import { loginAdmin, isAdminLoggedIn, logoutAdmin, isStudentViewEnabled, setStudentView } from '../services/admin-service.js';

export function renderAdmin(container, params) {
  if (isAdminLoggedIn()) {
    renderAdminPanel(container);
  } else {
    renderAdminLogin(container);
  }
}

function renderAdminLogin(container) {
  container.innerHTML = `
    <div class="admin-login-page">
      <div class="admin-login-card">
        <div class="admin-icon">&#128272;</div>
        <h2>관리자 로그인</h2>
        <p class="admin-subtitle">관리자 비밀번호를 입력하세요</p>
        <input type="password" id="admin-pw-input" placeholder="Password" autocomplete="off">
        <div class="error-msg" id="admin-error" style="display:none"></div>
        <button class="btn btn-primary" id="admin-login-btn">로그인</button>
        <button class="btn btn-ghost" id="admin-back-btn">&larr; 돌아가기</button>
      </div>
    </div>
  `;

  const pwInput = container.querySelector('#admin-pw-input');
  const loginBtn = container.querySelector('#admin-login-btn');
  const backBtn = container.querySelector('#admin-back-btn');
  const errorEl = container.querySelector('#admin-error');

  async function attemptLogin() {
    const password = pwInput.value.trim();
    if (!password) {
      showError('비밀번호를 입력하세요');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = '확인 중...';

    const success = await loginAdmin(password);
    if (success) {
      window.location.hash = '#catalog';
    } else {
      showError('비밀번호가 일치하지 않습니다');
      pwInput.value = '';
      pwInput.focus();

      // shake 애니메이션
      const card = container.querySelector('.admin-login-card');
      card.style.animation = 'shake 0.4s ease';
      setTimeout(() => card.style.animation = '', 400);
    }

    loginBtn.disabled = false;
    loginBtn.textContent = '로그인';
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }

  loginBtn.addEventListener('click', attemptLogin);
  pwInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptLogin();
  });
  backBtn.addEventListener('click', () => {
    window.location.hash = '#catalog';
  });

  setTimeout(() => pwInput.focus(), 100);
}

function renderAdminPanel(container) {
  const isStudentMode = isStudentViewEnabled();

  container.innerHTML = `
    <div class="admin-login-page">
      <div class="admin-panel">
        <div class="admin-icon">&#128274;</div>
        <h2>관리자 모드 <span class="admin-badge">ADMIN</span></h2>
        <p class="admin-subtitle">모든 교재에 전체 접근이 가능합니다.</p>

        <div class="admin-toggle-row">
          <label class="admin-toggle-label">
            <input type="checkbox" id="student-view-toggle" ${isStudentMode ? 'checked' : ''}>
            <span>학생 모드로 보기</span>
          </label>
          <p class="admin-toggle-desc">활성화하면 학생과 동일한 미리보기 제한이 적용됩니다.</p>
        </div>

        <div class="admin-actions">
          <button class="btn btn-primary" id="go-catalog-btn">교재 목록 보기</button>
          <button class="btn btn-ghost" id="admin-logout-btn">관리자 로그아웃</button>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#student-view-toggle').addEventListener('change', (e) => {
    setStudentView(e.target.checked);
  });

  container.querySelector('#go-catalog-btn').addEventListener('click', () => {
    window.location.hash = '#catalog';
  });

  container.querySelector('#admin-logout-btn').addEventListener('click', () => {
    logoutAdmin();
    renderAdminLogin(container);
  });
}
