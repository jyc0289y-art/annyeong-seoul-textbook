/**
 * 오프라인 감지 및 UI 관리
 * - navigator.onLine 체크
 * - online/offline 이벤트 리스너
 * - 오프라인 배너 UI
 * - 네트워크 복구 시 자동 재시도 콜백
 */

let isOffline = !navigator.onLine;
const reconnectCallbacks = new Set();
let bannerEl = null;

/**
 * 현재 오프라인 상태 여부
 */
export function getIsOffline() {
  return !navigator.onLine;
}

/**
 * 네트워크 복구 시 실행할 콜백 등록
 */
export function onReconnect(callback) {
  reconnectCallbacks.add(callback);
  return () => reconnectCallbacks.delete(callback);
}

/**
 * 오프라인 배너 표시
 */
function showOfflineBanner() {
  if (bannerEl) return;
  bannerEl = document.createElement('div');
  bannerEl.id = 'offline-banner';
  bannerEl.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    background: #E86B6B; color: #fff; text-align: center;
    padding: 8px 16px; font-size: 0.85rem; font-weight: 500;
    transition: transform 0.3s ease;
    font-family: 'Noto Sans KR', sans-serif;
  `;
  bannerEl.textContent = '오프라인 모드 — 인터넷 연결이 없습니다. 캐시된 데이터로 표시합니다.';
  document.body.prepend(bannerEl);
}

/**
 * 오프라인 배너 제거
 */
function hideOfflineBanner() {
  if (bannerEl) {
    bannerEl.remove();
    bannerEl = null;
  }
}

/**
 * 온라인 복구 토스트 표시 (2초 후 자동 제거)
 */
function showOnlineToast() {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    background: #2D5A7B; color: #fff; text-align: center;
    padding: 8px 16px; font-size: 0.85rem; font-weight: 500;
    transition: opacity 0.5s ease;
    font-family: 'Noto Sans KR', sans-serif;
  `;
  toast.textContent = '온라인 복구 — 인터넷에 다시 연결되었습니다.';
  document.body.prepend(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
  }, 2000);
}

/**
 * 초기화: 이벤트 리스너 등록
 */
export function initOfflineManager() {
  window.addEventListener('offline', () => {
    isOffline = true;
    showOfflineBanner();
    console.log('[Offline] Network lost');
  });

  window.addEventListener('online', () => {
    isOffline = false;
    hideOfflineBanner();
    showOnlineToast();
    console.log('[Offline] Network restored, running reconnect callbacks');
    reconnectCallbacks.forEach(cb => {
      try { cb(); } catch (e) { console.warn('[Offline] Reconnect callback error:', e); }
    });
  });

  // 초기 상태 체크
  if (!navigator.onLine) {
    showOfflineBanner();
  }
}
