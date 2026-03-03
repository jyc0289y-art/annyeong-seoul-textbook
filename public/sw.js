/**
 * Service Worker - 안녕, 서울 교재 뷰어
 * 오프라인 지원: 앱 셸 + 암호화 PDF + 프리뷰 PDF 캐싱
 *
 * 캐시 전략:
 * - 앱 셸 (HTML, CSS, JS): Cache First, 네트워크 업데이트
 * - 암호화 PDF (.enc): Cache First (용량 크므로 한번 받으면 캐시)
 * - 프리뷰 PDF: Cache First
 * - Firestore/API: Network Only (IndexedDB에서 별도 캐시)
 * - 폰트/CDN: Cache First
 */

const CACHE_NAME = 'sl-textbook-v1';
const APP_SHELL = [
  './',
  './index.html',
];

// 캐시 대상 URL 패턴
const CACHEABLE_PATTERNS = [
  /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|ico)(\?|$)/,  // 정적 자산
  /\/pdfs-encrypted\/.+\.enc$/,                               // 암호화 PDF
  /\/previews\/.+\.pdf$/,                                     // 프리뷰 PDF
  /fonts\.googleapis\.com/,                                    // Google Fonts CSS
  /fonts\.gstatic\.com/,                                       // Google Fonts 파일
  /cdn\.jsdelivr\.net.*pdfjs/,                                 // PDF.js CDN
];

// 캐시하지 않을 패턴
const NO_CACHE_PATTERNS = [
  /firestore\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
  /firebase/,
  /demo-keys\.json/,
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // POST 등 비-GET 요청은 패스
  if (request.method !== 'GET') return;

  // 캐시 제외 패턴 확인
  if (NO_CACHE_PATTERNS.some(pattern => pattern.test(url))) return;

  // 캐시 대상 확인
  const isCacheable = CACHEABLE_PATTERNS.some(pattern => pattern.test(url));

  if (isCacheable) {
    // Cache First 전략: 캐시 → 네트워크 폴백
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          // 백그라운드에서 캐시 업데이트 (stale-while-revalidate for non-PDF assets)
          if (!url.includes('.enc') && !url.includes('.pdf')) {
            event.waitUntil(
              fetch(request).then(response => {
                if (response.ok) {
                  caches.open(CACHE_NAME).then(cache => cache.put(request, response));
                }
              }).catch(() => { /* 오프라인이면 무시 */ })
            );
          }
          return cached;
        }

        // 캐시 미스: 네트워크에서 가져와 캐시에 저장
        return fetch(request).then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          }
          return response;
        });
      })
    );
  } else if (request.mode === 'navigate') {
    // HTML 네비게이션: 네트워크 우선, 오프라인 시 캐시된 index.html 반환
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
  }
  // 나머지는 브라우저 기본 동작
});
