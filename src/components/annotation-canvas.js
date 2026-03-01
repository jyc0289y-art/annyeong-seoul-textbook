/**
 * 필기 캔버스 엔진
 * PDF 캔버스 위에 올라가는 드로잉 레이어
 * Pointer Events API — 마우스, 터치, Apple Pencil 통합 지원
 */
import { getStrokeOutlinePoints, renderStroke } from './stroke-renderer.js';
import { getAnnotation, saveAnnotation } from '../services/annotation-store.js';

let annotationCanvas = null;
let ctx = null;
let isDrawing = false;
let currentStroke = null;
let strokes = [];
let undoStack = [];
let redoStack = [];
let currentTool = 'pen';
let currentColor = '#ff0000';
let currentSize = 3;
let annotationMode = false;
let currentBookId = null;
let currentPageNum = null;

/**
 * 필기 캔버스 초기화
 * @param {HTMLElement} pageWrapper - page-wrapper 요소
 */
export function initAnnotationCanvas(pageWrapper) {
  // 기존 캔버스가 있으면 제거
  const existing = pageWrapper.querySelector('#annotation-canvas');
  if (existing) existing.remove();

  annotationCanvas = document.createElement('canvas');
  annotationCanvas.id = 'annotation-canvas';
  annotationCanvas.className = 'annotation-canvas';

  // watermark-canvas 앞에 삽입 (z-index: 10, watermark는 20)
  const watermarkCanvas = pageWrapper.querySelector('#watermark-canvas');
  if (watermarkCanvas) {
    pageWrapper.insertBefore(annotationCanvas, watermarkCanvas);
  } else {
    pageWrapper.appendChild(annotationCanvas);
  }

  ctx = annotationCanvas.getContext('2d');
  bindPointerEvents();
}

/**
 * 캔버스 크기 조정 (PDF 크기에 맞춤)
 */
export function resizeAnnotationCanvas(width, height) {
  if (!annotationCanvas) return;
  annotationCanvas.width = width;
  annotationCanvas.height = height;
  annotationCanvas.style.width = width + 'px';
  annotationCanvas.style.height = height + 'px';
  redrawAllStrokes();
}

/**
 * 필기 모드 ON/OFF
 */
export function setAnnotationMode(enabled) {
  annotationMode = enabled;
  if (annotationCanvas) {
    annotationCanvas.classList.toggle('active', enabled);
  }
}

/**
 * 필기 모드 상태 확인
 */
export function isAnnotationModeActive() {
  return annotationMode;
}

/**
 * 페이지 필기 데이터 로드 (IndexedDB)
 */
export async function loadPageAnnotations(bookId, pageNumber) {
  currentBookId = bookId;
  currentPageNum = pageNumber;
  try {
    const data = await getAnnotation(bookId, pageNumber);
    strokes = data ? [...data.strokes] : [];
  } catch (err) {
    console.warn('필기 로드 실패:', err);
    strokes = [];
  }
  undoStack = [];
  redoStack = [];
  redrawAllStrokes();
}

/**
 * 현재 페이지 필기 데이터 저장 (IndexedDB)
 */
export async function saveCurrentAnnotations() {
  if (!currentBookId || currentPageNum == null) return;
  if (strokes.length === 0) return; // 빈 데이터는 저장하지 않음
  try {
    await saveAnnotation(currentBookId, currentPageNum, { strokes });
  } catch (err) {
    console.warn('필기 저장 실패:', err);
  }
}

// === Pointer Events ===

function bindPointerEvents() {
  annotationCanvas.addEventListener('pointerdown', onPointerDown);
  annotationCanvas.addEventListener('pointermove', onPointerMove);
  annotationCanvas.addEventListener('pointerup', onPointerUp);
  annotationCanvas.addEventListener('pointercancel', onPointerUp);

  // 필기 모드에서 터치 스크롤 방지
  annotationCanvas.addEventListener('touchstart', (e) => {
    if (annotationMode) e.preventDefault();
  }, { passive: false });

  annotationCanvas.addEventListener('touchmove', (e) => {
    if (annotationMode) e.preventDefault();
  }, { passive: false });
}

function getCanvasPoint(e) {
  const rect = annotationCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (annotationCanvas.width / rect.width),
    y: (e.clientY - rect.top) * (annotationCanvas.height / rect.height),
    pressure: e.pressure || 0.5
  };
}

function onPointerDown(e) {
  if (!annotationMode) return;
  isDrawing = true;
  annotationCanvas.setPointerCapture(e.pointerId);

  const point = getCanvasPoint(e);

  if (currentTool === 'eraser') {
    currentStroke = {
      tool: 'eraser',
      points: [point]
    };
  } else {
    currentStroke = {
      tool: currentTool,
      color: currentColor,
      size: currentSize,
      opacity: currentTool === 'highlighter' ? 0.3 : 1.0,
      points: [point]
    };
  }
}

function onPointerMove(e) {
  if (!isDrawing || !currentStroke) return;

  const point = getCanvasPoint(e);
  currentStroke.points.push(point);

  // 실시간 미리보기
  redrawAllStrokes();
  if (currentStroke.tool !== 'eraser') {
    renderSingleStroke(currentStroke);
  } else {
    // 지우개: 빨간 점으로 위치 표시
    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, currentSize * 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

function onPointerUp(e) {
  if (!isDrawing) return;
  isDrawing = false;

  if (currentStroke && currentStroke.points.length > 1) {
    if (currentStroke.tool === 'eraser') {
      eraseStrokes(currentStroke.points);
    } else {
      strokes.push(currentStroke);
      undoStack.push({ type: 'add', index: strokes.length - 1 });
      redoStack = [];
    }
    saveCurrentAnnotations();
  }

  currentStroke = null;
  redrawAllStrokes();
}

// === 지우개 ===

function eraseStrokes(eraserPoints) {
  const eraseRadius = currentSize * 3;
  const toRemove = [];

  for (let si = strokes.length - 1; si >= 0; si--) {
    const stroke = strokes[si];
    for (const ep of eraserPoints) {
      for (const sp of stroke.points) {
        const dx = ep.x - sp.x;
        const dy = ep.y - sp.y;
        if (Math.sqrt(dx * dx + dy * dy) < eraseRadius) {
          toRemove.push(si);
          break;
        }
      }
      if (toRemove.includes(si)) break;
    }
  }

  // 중복 제거 후 역순 삭제
  const unique = [...new Set(toRemove)].sort((a, b) => b - a);
  for (const idx of unique) {
    const removed = strokes.splice(idx, 1)[0];
    undoStack.push({ type: 'erase', stroke: removed, index: idx });
  }
  redoStack = [];
}

// === 렌더링 ===

function redrawAllStrokes() {
  if (!ctx || !annotationCanvas) return;
  ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  for (const stroke of strokes) {
    renderSingleStroke(stroke);
  }
}

function renderSingleStroke(stroke) {
  if (!stroke || stroke.tool === 'eraser') return;

  const outline = getStrokeOutlinePoints(stroke.points, {
    size: stroke.size,
    thinning: stroke.tool === 'pen' ? 0.5 : 0,
    smoothing: 0.5,
    streamline: 0.5
  });

  ctx.save();
  if (stroke.tool === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply';
  }
  renderStroke(ctx, outline, stroke.color, stroke.opacity);
  ctx.restore();
}

// === Undo / Redo ===

export function undo() {
  if (strokes.length === 0 && undoStack.length === 0) return;

  const lastAction = undoStack.pop();
  if (!lastAction) {
    // undoStack이 비어있으면 마지막 스트로크 제거
    if (strokes.length > 0) {
      const removed = strokes.pop();
      redoStack.push(removed);
    }
  } else if (lastAction.type === 'add') {
    const removed = strokes.pop();
    if (removed) redoStack.push(removed);
  } else if (lastAction.type === 'erase') {
    // 지운 스트로크 복원
    strokes.splice(lastAction.index, 0, lastAction.stroke);
    redoStack.push({ type: 'erase-undo', stroke: lastAction.stroke, index: lastAction.index });
  }

  redrawAllStrokes();
  saveCurrentAnnotations();
}

export function redo() {
  if (redoStack.length === 0) return;

  const item = redoStack.pop();
  if (item.type === 'erase-undo') {
    // 다시 지우기
    strokes.splice(item.index, 1);
  } else {
    strokes.push(item);
  }

  redrawAllStrokes();
  saveCurrentAnnotations();
}

export function clearAll() {
  if (strokes.length === 0) return;
  redoStack = [...strokes];
  strokes = [];
  redrawAllStrokes();
  saveCurrentAnnotations();
}

// === 도구 설정 ===

export function setTool(tool) { currentTool = tool; }
export function setColor(color) { currentColor = color; }
export function setSize(size) { currentSize = size; }
export function hasAnnotations() { return strokes.length > 0; }
