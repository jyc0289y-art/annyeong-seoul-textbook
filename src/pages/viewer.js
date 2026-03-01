import * as pdfjsLib from 'pdfjs-dist';
import { BOOKS } from '../config/books.js';
import { getCurrentUser, loginWithGoogle, loginWithApple } from '../firebase.js';
import { drawWatermark } from '../components/watermark.js';
import { decryptPdf, loadPreviewPdf } from '../services/pdf-decrypt-service.js';
import { verifyAccessCode, checkAccess, grantAccess } from '../services/access-code-service.js';
import { isAdminLoggedIn } from '../services/admin-service.js';
import { initAnnotationCanvas, resizeAnnotationCanvas, loadPageAnnotations, saveCurrentAnnotations, isAnnotationModeActive } from '../components/annotation-canvas.js';
import { createAnnotationToolbar, destroyAnnotationToolbar } from '../components/annotation-toolbar.js';

// PDF.js worker 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

let pdfDoc = null;
let previewDoc = null;
let currentPage = 1;
let totalPages = 0;
let previewPages = 0;
let currentBook = null;
let scale = 1.5;
let hasFullAccess = false;
let isLoadingFullPdf = false;

export async function renderViewer(container, params) {
  const bookId = params.get('book');
  const embed = params.get('embed') === 'true';
  currentBook = BOOKS.find(b => b.id === bookId);

  if (!currentBook) {
    container.innerHTML = '<p style="padding:40px;text-align:center">교재를 찾을 수 없습니다.</p>';
    return;
  }

  // 접근 권한 확인
  const user = getCurrentUser();
  hasFullAccess = await checkAccess(bookId, user?.uid);
  previewPages = currentBook.previewPages;

  const startPage = parseInt(params.get('page')) || 1;

  container.innerHTML = `
    <div class="viewer-container">
      ${embed ? '' : `
      <div class="viewer-toolbar">
        <button class="back-btn" id="back-btn">&larr; 목록</button>
        <span class="book-title">${currentBook.title_ko} ${isAdminLoggedIn() ? '<span class="admin-badge-sm">ADMIN</span>' : ''}</span>
        <div class="page-info">
          <button class="page-nav-btn" id="prev-btn">&lsaquo;</button>
          <span id="page-display">- / -</span>
          <button class="page-nav-btn" id="next-btn">&rsaquo;</button>
        </div>
        <div style="width:80px"></div>
      </div>`}

      <div class="viewer-body" id="viewer-body">
        <div class="page-wrapper" id="page-wrapper">
          <canvas id="pdf-canvas"></canvas>
          <canvas id="watermark-canvas" class="watermark-canvas"></canvas>
          <div id="lock-overlay" class="lock-overlay" style="display:none">
            <div class="lock-icon">&#128274;</div>
            <p>미리보기가 끝났습니다.<br>전체 교재를 열람하려면 로그인 후<br>접근 코드를 입력하세요.</p>
            <button class="btn btn-primary" id="unlock-btn" style="margin-top:8px">잠금 해제</button>
          </div>
          <div id="loading-overlay" class="lock-overlay" style="display:none">
            <p>교재를 불러오는 중...</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // 필기 캔버스 초기화
  const pageWrapper = document.getElementById('page-wrapper');
  initAnnotationCanvas(pageWrapper);

  // 필기 도구 모음 생성
  const viewerContainer = container.querySelector('.viewer-container');
  createAnnotationToolbar(viewerContainer);

  try {
    if (hasFullAccess) {
      // 전체 접근: 암호화된 PDF 복호화
      await loadFullPdf(bookId, startPage);
    } else {
      // 미리보기: 프리뷰 PDF 로드
      await loadPreview(bookId, startPage);
    }
  } catch (err) {
    console.error('PDF load error:', err);

    // 폴백: 원본 PDF 직접 로드 (로컬 개발용)
    try {
      await loadDirectPdf(bookId, startPage);
    } catch (fallbackErr) {
      console.error('Fallback load error:', fallbackErr);
      document.getElementById('viewer-body').innerHTML =
        `<p style="padding:40px;text-align:center;color:var(--text-secondary)">
          PDF를 불러올 수 없습니다.<br>
          <span style="font-size:0.8rem">${err.message}</span><br><br>
          <span style="font-size:0.85rem">빌드 스크립트를 먼저 실행하세요:<br>
          <code>node scripts/encrypt-pdfs.js</code><br>
          <code>node scripts/generate-previews.js</code></span>
        </p>`;
    }
  }

  bindViewerEvents(container);
}

/**
 * 미리보기 PDF 로드 (첫 3페이지만 포함된 소형 PDF)
 */
async function loadPreview(bookId, startPage) {
  const previewData = await loadPreviewPdf(bookId);
  previewDoc = await pdfjsLib.getDocument({
    data: previewData,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/cmaps/',
    cMapPacked: true,
  }).promise;

  totalPages = currentBook.totalPages || previewDoc.numPages;
  pdfDoc = previewDoc;
  currentPage = Math.min(startPage, previewPages);
  await renderPage(currentPage);
}

/**
 * 전체 PDF 로드 (암호화 파일 복호화)
 */
async function loadFullPdf(bookId, startPage) {
  showLoadingOverlay();

  const decryptedData = await decryptPdf(bookId);
  pdfDoc = await pdfjsLib.getDocument({
    data: decryptedData,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/cmaps/',
    cMapPacked: true,
  }).promise;

  totalPages = pdfDoc.numPages;
  currentPage = Math.min(startPage, totalPages);
  hideLoadingOverlay();
  await renderPage(currentPage);
}

/**
 * 원본 PDF 직접 로드 (로컬 개발 폴백)
 */
async function loadDirectPdf(bookId, startPage) {
  const url = `./pdfs/${currentBook.pdfFile}`;
  pdfDoc = await pdfjsLib.getDocument({
    url,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/cmaps/',
    cMapPacked: true,
  }).promise;

  totalPages = pdfDoc.numPages;
  currentPage = Math.min(startPage, totalPages);
  await renderPage(currentPage);
}

async function renderPage(pageNum) {
  // 접근 제어 확인
  if (!hasFullAccess && pageNum > previewPages) {
    // 미리보기 모드에서 제한 페이지 초과
    updatePageDisplay(previewPages, totalPages);
    showLockOverlay();
    return;
  }

  hideLockOverlay();

  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const pdfCanvas = document.getElementById('pdf-canvas');
  const wmCanvas = document.getElementById('watermark-canvas');

  // 뷰어 너비에 맞게 스케일 조정
  const viewerBody = document.getElementById('viewer-body');
  const maxWidth = viewerBody.clientWidth - 48;
  let finalViewport = viewport;

  if (viewport.width > maxWidth) {
    scale = (maxWidth / (viewport.width / scale));
    finalViewport = page.getViewport({ scale });
  }

  setCanvasSize(pdfCanvas, finalViewport.width, finalViewport.height);
  setCanvasSize(wmCanvas, finalViewport.width, finalViewport.height);
  resizeAnnotationCanvas(finalViewport.width, finalViewport.height);

  await page.render({
    canvasContext: pdfCanvas.getContext('2d'),
    viewport: finalViewport
  }).promise;

  const user = getCurrentUser();
  drawWatermark(wmCanvas, user?.displayName || user?.email);

  // 필기 데이터 로드
  if (currentBook) {
    await loadPageAnnotations(currentBook.id, pageNum);
  }

  updatePageDisplay(pageNum, totalPages);
  currentPage = pageNum;
}

function updatePageDisplay(pageNum, total) {
  const display = document.getElementById('page-display');
  if (display) display.textContent = `${pageNum} / ${total}`;

  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  if (prevBtn) prevBtn.disabled = pageNum <= 1;
  if (nextBtn) nextBtn.disabled = pageNum >= total;
}

function setCanvasSize(canvas, w, h) {
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
}

function showLockOverlay() {
  const lock = document.getElementById('lock-overlay');
  if (lock) lock.style.display = 'flex';
}

function hideLockOverlay() {
  const lock = document.getElementById('lock-overlay');
  if (lock) lock.style.display = 'none';
}

function showLoadingOverlay() {
  const loading = document.getElementById('loading-overlay');
  if (loading) loading.style.display = 'flex';
}

function hideLoadingOverlay() {
  const loading = document.getElementById('loading-overlay');
  if (loading) loading.style.display = 'none';
}

function bindViewerEvents(container) {
  // 뒤로가기
  const backBtn = container.querySelector('#back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.hash = '#catalog';
    });
  }

  // 이전/다음 페이지
  const prevBtn = container.querySelector('#prev-btn');
  const nextBtn = container.querySelector('#next-btn');
  if (prevBtn) prevBtn.addEventListener('click', () => goPage(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => goPage(1));

  // 키보드 네비게이션
  const keyHandler = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPage(-1);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goPage(1);
  };
  document.addEventListener('keydown', keyHandler);

  // 잠금 해제 버튼
  const unlockBtn = container.querySelector('#unlock-btn');
  if (unlockBtn) {
    unlockBtn.addEventListener('click', () => handleUnlock(container));
  }

  // 터치 스와이프 (모바일/태블릿)
  let touchStartX = 0;
  const viewerBody = container.querySelector('#viewer-body');
  if (viewerBody) {
    viewerBody.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    viewerBody.addEventListener('touchend', (e) => {
      // 필기 모드에서는 스와이프 페이지 전환 비활성화
      if (isAnnotationModeActive()) return;
      const diff = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(diff) > 60) {
        goPage(diff < 0 ? 1 : -1);
      }
    }, { passive: true });
  }
}

async function goPage(delta) {
  // 페이지 전환 전 현재 필기 저장
  await saveCurrentAnnotations();

  const maxPage = hasFullAccess ? totalPages : previewPages;
  const newPage = currentPage + delta;
  if (newPage < 1) return;

  if (newPage > maxPage && !hasFullAccess) {
    showLockOverlay();
    return;
  }

  if (newPage > totalPages) return;
  renderPage(newPage);
}

/**
 * 잠금 해제 흐름
 * 1. 미로그인 → 로그인 모달
 * 2. 로그인 완료 → 접근 코드 모달
 * 3. 코드 검증 → 전체 PDF 복호화 로드
 */
async function handleUnlock(container) {
  const user = getCurrentUser();

  if (!user) {
    showLoginFirstModal(container);
    return;
  }

  showAccessCodeModal(container);
}

function showAccessCodeModal(container) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>접근 코드 입력</h2>
      <p>교사에게 받은 접근 코드를 입력하세요.<br>
         アクセスコードを入力してください。</p>
      <input type="text" id="access-code-input" placeholder="ACCESS CODE"
             maxlength="20" autocomplete="off" spellcheck="false">
      <div class="error-msg" id="code-error" style="display:none"></div>
      <div class="modal-actions" style="margin-top:16px">
        <button class="btn btn-primary" id="verify-code-btn">확인</button>
        <button class="btn btn-ghost" id="cancel-code-btn">취소</button>
      </div>
    </div>
  `;

  container.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('#cancel-code-btn').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#verify-code-btn').addEventListener('click', async () => {
    const code = overlay.querySelector('#access-code-input').value.trim().toUpperCase();
    if (!code) {
      showCodeError(overlay, '코드를 입력하세요');
      return;
    }

    const user = getCurrentUser();
    const isValid = await verifyAccessCode(currentBook.id, code, user?.uid);

    if (isValid) {
      await grantAccess(currentBook.id, code, user?.uid);
      hasFullAccess = true;
      overlay.remove();

      // 전체 PDF 로드 시도
      try {
        await loadFullPdf(currentBook.id, currentBook.previewPages + 1);
      } catch (err) {
        console.warn('암호화 PDF 로드 실패, 폴백:', err);
        // 폴백: 원본 PDF (로컬 개발)
        try {
          pdfDoc = null;
          await loadDirectPdf(currentBook.id, currentBook.previewPages + 1);
        } catch (e) {
          console.error('PDF 로드 완전 실패:', e);
        }
      }
    } else {
      showCodeError(overlay, '잘못된 코드입니다. 教師にコードを確認してください。');
    }
  });

  // Enter 키 지원
  overlay.querySelector('#access-code-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') overlay.querySelector('#verify-code-btn').click();
  });

  setTimeout(() => overlay.querySelector('#access-code-input').focus(), 100);
}

function showLoginFirstModal(container) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>로그인 필요</h2>
      <p>전체 교재를 열람하려면 먼저 로그인하세요.<br>
         全文を閲覧するにはログインが必要です。</p>
      <div class="modal-actions">
        <button class="btn-google" id="modal-google">Google로 로그인</button>
        <button class="btn-apple" id="modal-apple">Apple로 로그인</button>
        <button class="btn btn-ghost" id="modal-cancel" style="margin-top:8px">취소</button>
      </div>
    </div>
  `;

  container.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#modal-google').addEventListener('click', async () => {
    await loginWithGoogle();
    overlay.remove();
    showAccessCodeModal(container);
  });

  overlay.querySelector('#modal-apple').addEventListener('click', async () => {
    await loginWithApple();
    overlay.remove();
    showAccessCodeModal(container);
  });
}

function showCodeError(overlay, msg) {
  const err = overlay.querySelector('#code-error');
  err.textContent = msg;
  err.style.display = 'block';
}
