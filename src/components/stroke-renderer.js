/**
 * 스트로크 렌더러 — perfect-freehand 알고리즘 기반
 * 필압 감지를 활용한 부드러운 자유선 드로잉
 *
 * MIT 라이선스 기반 perfect-freehand 알고리즘을 인라인 구현 (~3KB)
 * https://github.com/steveruizok/perfect-freehand
 */

/**
 * 두 점 사이의 거리
 */
function dist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

/**
 * 두 점 사이를 보간
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * 입력 포인트에서 부드러운 스트로크 윤곽선 생성
 * @param {Array<{x, y, pressure}>} inputPoints - 입력 포인트 배열
 * @param {Object} options - { size, thinning, smoothing, streamline }
 * @returns {Array<[number, number]>} 폴리곤 윤곽 좌표 배열
 */
export function getStrokeOutlinePoints(inputPoints, options = {}) {
  const {
    size = 4,
    thinning = 0.5,
    smoothing = 0.5,
    streamline = 0.5,
    simulatePressure = true
  } = options;

  if (inputPoints.length < 2) return [];

  // 포인트를 [x, y, pressure] 형태로 정규화
  const points = inputPoints.map(p => [p.x, p.y, p.pressure || 0.5]);

  // 스트림라인 적용 (떨림 감소)
  const streamlined = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = streamlined[streamlined.length - 1];
    const curr = points[i];
    streamlined.push([
      lerp(prev[0], curr[0], 1 - streamline),
      lerp(prev[1], curr[1], 1 - streamline),
      lerp(prev[2], curr[2], 1 - streamline)
    ]);
  }

  // 각 포인트에서의 선 폭 계산
  const leftPoints = [];
  const rightPoints = [];

  for (let i = 0; i < streamlined.length; i++) {
    const point = streamlined[i];
    let pressure = point[2];

    // 필압이 없는 경우 시뮬레이션
    if (simulatePressure && pressure === 0.5) {
      // 속도 기반 시뮬레이션: 빠르면 가늘게, 느리면 굵게
      if (i > 0) {
        const d = dist([point[0], point[1]], [streamlined[i - 1][0], streamlined[i - 1][1]]);
        pressure = Math.max(0.2, 1 - Math.min(1, d / 50));
      }
    }

    // thinning에 따른 폭 변화
    const halfWidth = size * (1 - thinning + thinning * pressure) / 2;

    // 이전/다음 포인트를 사용하여 법선 벡터 계산
    let nx, ny;
    if (i === 0) {
      const next = streamlined[i + 1];
      const dx = next[0] - point[0];
      const dy = next[1] - point[1];
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / len;
      ny = dx / len;
    } else if (i === streamlined.length - 1) {
      const prev = streamlined[i - 1];
      const dx = point[0] - prev[0];
      const dy = point[1] - prev[1];
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / len;
      ny = dx / len;
    } else {
      const prev = streamlined[i - 1];
      const next = streamlined[i + 1];
      const dx = next[0] - prev[0];
      const dy = next[1] - prev[1];
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / len;
      ny = dx / len;
    }

    leftPoints.push([
      point[0] + nx * halfWidth,
      point[1] + ny * halfWidth
    ]);
    rightPoints.push([
      point[0] - nx * halfWidth,
      point[1] - ny * halfWidth
    ]);
  }

  // 시작/끝 캡 추가 (둥근 끝)
  const startCap = generateCap(streamlined[0], leftPoints[0], rightPoints[0], size);
  const endCap = generateCap(
    streamlined[streamlined.length - 1],
    leftPoints[leftPoints.length - 1],
    rightPoints[rightPoints.length - 1],
    size
  );

  // 폴리곤 조합: left → endCap → right(역순) → startCap
  return [
    ...leftPoints,
    ...endCap,
    ...rightPoints.reverse(),
    ...startCap
  ];
}

/**
 * 끝 부분 둥근 캡 생성
 */
function generateCap(center, left, right, size) {
  const steps = 4;
  const cap = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    cap.push([
      lerp(left[0], right[0], t),
      lerp(left[1], right[1], t)
    ]);
  }
  return cap;
}

/**
 * 캔버스에 스트로크 그리기
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D 컨텍스트
 * @param {Array<[number, number]>} outlinePoints - 폴리곤 윤곽 좌표
 * @param {string} color - 색상 (hex)
 * @param {number} opacity - 불투명도 (0~1)
 */
export function renderStroke(ctx, outlinePoints, color, opacity = 1.0) {
  if (outlinePoints.length < 3) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);

  for (let i = 1; i < outlinePoints.length; i++) {
    ctx.lineTo(outlinePoints[i][0], outlinePoints[i][1]);
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
