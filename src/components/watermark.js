// 워터마크 오버레이 렌더러
export function drawWatermark(canvas, userName) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.font = '16px "Noto Sans KR", sans-serif';
  ctx.fillStyle = '#000000';
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 6);

  const name = userName || 'Preview';
  const date = new Date().toLocaleDateString('ko-KR');
  const text = `SL Corp. | ${name} | ${date}`;

  for (let y = -h; y < h; y += 80) {
    for (let x = -w; x < w; x += 350) {
      ctx.fillText(text, x, y);
    }
  }

  ctx.restore();
}
