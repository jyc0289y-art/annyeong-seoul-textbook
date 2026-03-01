/**
 * 필기 데이터 저장소 (IndexedDB)
 * 페이지별 스트로크 데이터를 로컬에 저장/불러오기
 */

const DB_NAME = 'annyeong-seoul-annotations';
const DB_VERSION = 1;
const STORE_ANNOTATIONS = 'annotations';
const STORE_SETTINGS = 'settings';

let dbPromise = null;

/**
 * IndexedDB 연결
 */
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_ANNOTATIONS)) {
        db.createObjectStore(STORE_ANNOTATIONS);
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

/**
 * 페이지별 필기 데이터 조회
 * @param {string} bookId - 교재 ID
 * @param {number} pageNumber - 페이지 번호
 * @returns {Object|null} 필기 데이터
 */
export async function getAnnotation(bookId, pageNumber) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ANNOTATIONS, 'readonly');
    const store = tx.objectStore(STORE_ANNOTATIONS);
    const request = store.get(`${bookId}-${pageNumber}`);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 페이지별 필기 데이터 저장
 * @param {string} bookId - 교재 ID
 * @param {number} pageNumber - 페이지 번호
 * @param {Object} data - { strokes: [...] }
 */
export async function saveAnnotation(bookId, pageNumber, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ANNOTATIONS, 'readwrite');
    const store = tx.objectStore(STORE_ANNOTATIONS);
    store.put({
      bookId,
      pageNumber,
      strokes: data.strokes,
      updatedAt: Date.now(),
      version: 1
    }, `${bookId}-${pageNumber}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 페이지별 필기 데이터 삭제
 */
export async function deleteAnnotation(bookId, pageNumber) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ANNOTATIONS, 'readwrite');
    const store = tx.objectStore(STORE_ANNOTATIONS);
    store.delete(`${bookId}-${pageNumber}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 도구 설정 조회
 */
export async function getSettings() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const store = tx.objectStore(STORE_SETTINGS);
    const request = store.get('preferences');
    request.onsuccess = () => resolve(request.result || {
      defaultColor: '#ff0000',
      defaultSize: 3,
      defaultTool: 'pen'
    });
    request.onerror = () => reject(request.error);
  });
}

/**
 * 도구 설정 저장
 */
export async function saveSettings(settings) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    const store = tx.objectStore(STORE_SETTINGS);
    store.put(settings, 'preferences');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 교재 전체 필기 데이터 내보내기 (JSON 백업)
 */
export async function exportBookAnnotations(bookId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ANNOTATIONS, 'readonly');
    const store = tx.objectStore(STORE_ANNOTATIONS);
    const request = store.getAll();
    request.onsuccess = () => {
      const allData = request.result || [];
      const bookData = allData.filter(d => d.bookId === bookId);
      resolve({
        bookId,
        exportedAt: Date.now(),
        annotations: bookData
      });
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * 필기 데이터 가져오기 (JSON 복원)
 */
export async function importAnnotations(jsonData) {
  const db = await openDB();
  const { annotations } = jsonData;
  if (!annotations || !Array.isArray(annotations)) {
    throw new Error('Invalid annotation data format');
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ANNOTATIONS, 'readwrite');
    const store = tx.objectStore(STORE_ANNOTATIONS);
    for (const anno of annotations) {
      store.put(anno, `${anno.bookId}-${anno.pageNumber}`);
    }
    tx.oncomplete = () => resolve(annotations.length);
    tx.onerror = () => reject(tx.error);
  });
}
