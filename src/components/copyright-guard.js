// 저작권 보호 — 다중 레이어
export function installCopyrightGuard() {
  // 1. 우클릭 차단
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

  // 2. 키보드 단축키 차단
  document.addEventListener('keydown', (e) => {
    // Ctrl+P / Cmd+P (인쇄)
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      return false;
    }
    // Ctrl+S / Cmd+S (저장)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+I (개발자 도구) — 참고용, 완전 차단 불가
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      return false;
    }
    // Ctrl+U (소스 보기)
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      return false;
    }
  });

  // 3. 드래그 차단
  document.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'CANVAS' || e.target.tagName === 'IMG') {
      e.preventDefault();
    }
  });

  // 4. 텍스트 선택 차단은 CSS user-select: none으로 처리 (global.css)
}
