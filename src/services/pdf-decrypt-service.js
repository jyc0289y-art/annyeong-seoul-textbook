/**
 * PDF 복호화 서비스
 * AES-256-GCM 암호화된 PDF를 브라우저에서 복호화
 * Web Crypto API 사용 (브라우저 내장, 외부 라이브러리 불필요)
 *
 * 키 로드 순서:
 * 1. Firestore (인증된 사용자 + 접근 권한 필요)
 * 2. IndexedDB 캐시 폴백 (오프라인 지원)
 * 3. demo-keys.json 폴백 (개발/데모용)
 */
import { getCurrentUser, isFirebaseConfigured } from '../firebase.js';
import { withTimeout } from '../utils/fetch-with-timeout.js';
import { getIsOffline } from '../utils/offline-manager.js';

// 데모 모드용 키 캐시
let demoKeys = null;

// IndexedDB 키 캐시 (오프라인 지원)
const KEY_CACHE_DB = 'sl_key_cache';
const KEY_CACHE_STORE = 'keys';

/**
 * IndexedDB에서 캐시된 키 가져오기
 */
async function getCachedKey(bookId) {
  try {
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open(KEY_CACHE_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(KEY_CACHE_STORE)) {
          db.createObjectStore(KEY_CACHE_STORE);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(KEY_CACHE_STORE, 'readonly');
        const store = tx.objectStore(KEY_CACHE_STORE);
        const getReq = store.get(bookId);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

/**
 * IndexedDB에 키 캐시 저장
 */
async function setCachedKey(bookId, keyData) {
  try {
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open(KEY_CACHE_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(KEY_CACHE_STORE)) {
          db.createObjectStore(KEY_CACHE_STORE);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(KEY_CACHE_STORE, 'readwrite');
        const store = tx.objectStore(KEY_CACHE_STORE);
        store.put(keyData, bookId);
        tx.oncomplete = () => resolve();
      };
      req.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

/**
 * Base64 문자열을 ArrayBuffer로 변환
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Firestore에서 복호화 키 가져오기
 * 보안 규칙: 인증 + userAccess 문서 존재 확인
 */
async function getKeyFromFirestore(bookId) {
  // 오프라인이면 Firestore 호출 건너뛰기
  if (getIsOffline()) {
    console.log(`[Decrypt] Offline — skipping Firestore, trying cache for: ${bookId}`);
    return null;
  }

  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase.js');

    if (!db) return null;

    // 5초 타임아웃 적용 (지하철 터널 등 대비)
    const keyDoc = await withTimeout(
      getDoc(doc(db, 'encryptionKeys', bookId)),
      5000,
      'getKey'
    );

    if (keyDoc.exists()) {
      const data = keyDoc.data();
      // 성공 시 IndexedDB에 캐시 저장 (다음 오프라인 대비)
      await setCachedKey(bookId, data);
      console.log(`[Decrypt] Key loaded from Firestore (cached) for: ${bookId}`);
      return data;
    }

    console.warn(`[Decrypt] No key found in Firestore for: ${bookId}`);
    return null;
  } catch (error) {
    if (error.code === 'permission-denied') {
      console.warn(`[Decrypt] Firestore access denied for: ${bookId} (need valid access code)`);
    } else if (error.message?.includes('TIMEOUT')) {
      console.warn(`[Decrypt] Firestore timeout for: ${bookId}, trying cache`);
    } else {
      console.error(`[Decrypt] Firestore error for: ${bookId}`, error.message);
    }
    return null;
  }
}

/**
 * 데모 키 로드 (개발/테스트용)
 * 빌드 시 생성된 demo-keys.json에서 로드
 */
async function getDemoKey(bookId) {
  if (!demoKeys) {
    try {
      const response = await fetch('./demo-keys.json');
      if (response.ok) {
        demoKeys = await response.json();
      }
    } catch (e) {
      // 데모 키 파일이 없으면 null
    }
  }
  return demoKeys ? demoKeys[bookId] : null;
}

/**
 * 암호화된 PDF를 복호화
 * @param {string} bookId - 교재 ID
 * @returns {ArrayBuffer} 복호화된 PDF 데이터
 */
export async function decryptPdf(bookId) {
  // 1. 암호화 키 가져오기
  let keyData;

  if (isFirebaseConfigured()) {
    keyData = await getKeyFromFirestore(bookId);
  }

  // Firestore 실패 시 IndexedDB 캐시 폴백 (오프라인 지원)
  if (!keyData) {
    keyData = await getCachedKey(bookId);
    if (keyData) {
      console.log(`[Decrypt] Key loaded from IndexedDB cache for: ${bookId}`);
    }
  }

  // 캐시에도 없으면 데모 키 폴백
  if (!keyData) {
    keyData = await getDemoKey(bookId);
  }

  if (!keyData) {
    throw new Error(getIsOffline() ? 'OFFLINE_NO_CACHED_KEY' : 'DECRYPTION_KEY_NOT_FOUND');
  }

  // 2. 암호화된 파일 다운로드
  const encUrl = `./pdfs-encrypted/${bookId}.enc`;
  const response = await fetch(encUrl);

  if (!response.ok) {
    throw new Error(`ENCRYPTED_FILE_NOT_FOUND: ${encUrl}`);
  }

  const encryptedBuffer = await response.arrayBuffer();
  const encryptedData = new Uint8Array(encryptedBuffer);

  // 3. 파일 구조 파싱: [12바이트 IV] + [16바이트 authTag] + [암호화 데이터]
  const iv = encryptedData.slice(0, 12);
  const authTag = encryptedData.slice(12, 28);
  const ciphertext = encryptedData.slice(28);

  // 4. GCM에서는 authTag을 ciphertext 뒤에 붙여야 함 (Web Crypto API 방식)
  const ciphertextWithTag = new Uint8Array(ciphertext.length + authTag.length);
  ciphertextWithTag.set(ciphertext);
  ciphertextWithTag.set(authTag, ciphertext.length);

  // 5. Web Crypto API로 복호화
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    base64ToArrayBuffer(keyData.key),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    cryptoKey,
    ciphertextWithTag.buffer
  );

  return decryptedBuffer;
}

/**
 * 미리보기 PDF 로드
 * @param {string} bookId - 교재 ID
 * @returns {ArrayBuffer} 미리보기 PDF 데이터
 */
export async function loadPreviewPdf(bookId) {
  const previewUrl = `./previews/${bookId}-preview.pdf`;
  const response = await fetch(previewUrl);

  if (!response.ok) {
    throw new Error(`PREVIEW_NOT_FOUND: ${previewUrl}`);
  }

  return await response.arrayBuffer();
}
