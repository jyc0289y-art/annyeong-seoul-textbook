/**
 * 타임아웃이 적용된 fetch 래퍼
 * 지하철 터널 등에서 네트워크 끊김 시 무한 대기 방지
 */

/**
 * 타임아웃 적용 fetch
 * @param {string} url - 요청 URL
 * @param {RequestInit} options - fetch 옵션
 * @param {number} timeout - 타임아웃 (ms), 기본 8초
 * @returns {Promise<Response>}
 */
export function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const { signal } = controller;

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  return fetch(url, { ...options, signal })
    .then(response => {
      clearTimeout(timeoutId);
      return response;
    })
    .catch(err => {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`NETWORK_TIMEOUT: ${timeout}ms 초과 (${url})`);
      }
      throw err;
    });
}

/**
 * Firestore getDoc에 타임아웃 적용
 * @param {Promise} firestorePromise - Firestore 작업 Promise
 * @param {number} timeout - 타임아웃 (ms), 기본 5초
 * @param {string} label - 로그용 라벨
 * @returns {Promise}
 */
export function withTimeout(firestorePromise, timeout = 5000, label = 'Firestore') {
  return Promise.race([
    firestorePromise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT: ${label} ${timeout}ms 초과`)), timeout)
    )
  ]);
}
