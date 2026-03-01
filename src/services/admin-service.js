/**
 * 관리자 인증 서비스
 * SHA-256 해시 기반 비밀번호 인증 + localStorage 세션 관리
 */

// 관리자 비밀번호의 SHA-256 해시 (비밀번호 자체는 코드에 포함하지 않음)
const ADMIN_PASSWORD_HASH = '9c3d0e970ccfcb24b92a2f2ca4a54abf26122e168fc34c10ddbd6fdcb3b4f8ee';

const STORAGE_KEY = 'sl_admin_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24시간

/**
 * SHA-256 해시 생성 (Web Crypto API)
 */
async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 관리자 로그인
 * @param {string} password - 입력된 비밀번호
 * @returns {boolean} 로그인 성공 여부
 */
export async function loginAdmin(password) {
  const hash = await sha256(password);
  if (hash === ADMIN_PASSWORD_HASH) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      authenticated: true,
      loginTime: Date.now()
    }));
    return true;
  }
  return false;
}

/**
 * 관리자 로그인 상태 확인
 * @returns {boolean} 관리자 인증 여부 (24시간 세션)
 */
export function isAdminLoggedIn() {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!session || !session.authenticated) return false;
    if (Date.now() - session.loginTime > SESSION_DURATION) {
      logoutAdmin();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 관리자 로그아웃
 */
export function logoutAdmin() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem('sl_student_view');
}

/**
 * 학생 모드 활성화 여부 (관리자가 학생 관점에서 테스트)
 * sessionStorage 사용 → 탭 종료 시 자동 초기화
 */
export function isStudentViewEnabled() {
  return sessionStorage.getItem('sl_student_view') === 'true';
}

/**
 * 학생 모드 토글
 */
export function setStudentView(enabled) {
  if (enabled) {
    sessionStorage.setItem('sl_student_view', 'true');
  } else {
    sessionStorage.removeItem('sl_student_view');
  }
}
