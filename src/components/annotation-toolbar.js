/**
 * 필기 도구 모음 (플로팅 툴바)
 * 화면 하단에 고정되는 드로잉 도구 UI
 */
import {
  setAnnotationMode, setTool, setColor, setSize,
  undo, redo, clearAll, isAnnotationModeActive
} from './annotation-canvas.js';

const COLORS = ['#ff0000', '#0066ff', '#00cc00', '#ff9900', '#9933ff', '#000000'];
const TOOLS = [
  { id: 'pen', label: '펜', icon: '&#9998;' },
  { id: 'highlighter', label: '형광펜', icon: '&#9618;' },
  { id: 'eraser', label: '지우개', icon: '&#9109;' }
];

let toolbarEl = null;
let isActive = false;

/**
 * 필기 도구 모음 생성
 * @param {HTMLElement} viewerContainer - 뷰어 컨테이너 요소
 */
export function createAnnotationToolbar(viewerContainer) {
  // 기존 툴바 제거
  destroyAnnotationToolbar();

  toolbarEl = document.createElement('div');
  toolbarEl.className = 'annotation-toolbar';
  toolbarEl.innerHTML = `
    <button class="anno-toggle-btn" id="anno-toggle" title="필기 모드">
      <span>&#9998;</span>
    </button>
    <div class="anno-tools" id="anno-tools" style="display:none">
      <div class="anno-tool-group">
        ${TOOLS.map((t, i) => `
          <button class="anno-tool ${i === 0 ? 'active' : ''}"
                  data-tool="${t.id}" title="${t.label}">${t.icon}</button>
        `).join('')}
      </div>
      <div class="anno-divider"></div>
      <div class="anno-colors">
        ${COLORS.map((c, i) => `
          <button class="anno-color ${i === 0 ? 'active' : ''}"
                  data-color="${c}"
                  style="background:${c}"
                  title="${c}"></button>
        `).join('')}
      </div>
      <div class="anno-divider"></div>
      <input type="range" class="anno-size-slider" id="anno-size"
             min="1" max="20" value="3" title="굵기">
      <div class="anno-divider"></div>
      <button class="anno-action" id="anno-undo" title="되돌리기">&#8617;</button>
      <button class="anno-action" id="anno-redo" title="다시 실행">&#8618;</button>
      <button class="anno-action anno-action-danger" id="anno-clear" title="전체 지우기">&#128465;</button>
    </div>
  `;

  viewerContainer.appendChild(toolbarEl);
  bindToolbarEvents();
}

/**
 * 필기 도구 모음 제거
 */
export function destroyAnnotationToolbar() {
  if (toolbarEl) {
    toolbarEl.remove();
    toolbarEl = null;
    isActive = false;
  }
}

function bindToolbarEvents() {
  // 토글 버튼
  const toggleBtn = toolbarEl.querySelector('#anno-toggle');
  toggleBtn.addEventListener('click', () => {
    isActive = !isActive;
    setAnnotationMode(isActive);
    toolbarEl.querySelector('#anno-tools').style.display = isActive ? 'flex' : 'none';
    toggleBtn.classList.toggle('active', isActive);
  });

  // 도구 선택
  toolbarEl.querySelectorAll('.anno-tool').forEach(btn => {
    btn.addEventListener('click', () => {
      toolbarEl.querySelectorAll('.anno-tool').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setTool(btn.dataset.tool);
    });
  });

  // 색상 선택
  toolbarEl.querySelectorAll('.anno-color').forEach(btn => {
    btn.addEventListener('click', () => {
      toolbarEl.querySelectorAll('.anno-color').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setColor(btn.dataset.color);
    });
  });

  // 굵기 슬라이더
  toolbarEl.querySelector('#anno-size').addEventListener('input', (e) => {
    setSize(parseInt(e.target.value));
  });

  // 되돌리기 / 다시 실행 / 전체 지우기
  toolbarEl.querySelector('#anno-undo').addEventListener('click', undo);
  toolbarEl.querySelector('#anno-redo').addEventListener('click', redo);
  toolbarEl.querySelector('#anno-clear').addEventListener('click', () => {
    if (confirm('이 페이지의 모든 필기를 지우시겠습니까?')) {
      clearAll();
    }
  });
}
