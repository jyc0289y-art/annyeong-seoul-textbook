/**
 * PDF 복호화 서비스
 * AES-256-GCM 암호화된 PDF를 브라우저에서 복호화
 * Web Crypto API 사용 (브라우저 내장, 외부 라이브러리 불필요)
 */
import { getCurrentUser, isFirebaseConfigured } from '../firebase.js';

// 데모 모드용 키 (Firebase 미설정 시 사용)
// 실제 운영에서는 Firestore에서 키를 가져옴
let demoKeys = null;

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
 */
async function getKeyFromFirestore(bookId) {
  // Firebase가 설정되면 여기서 Firestore 조회
  // const { getFirestore, doc, getDoc } = await import('firebase/firestore');
  // const db = getFirestore();
  // const keyDoc = await getDoc(doc(db, 'encryptionKeys', bookId));
  // return keyDoc.data();

  // 아직 Firebase 미설정 — 데모 모드
  return null;
}

/**
 * 데모 키 로드 (개발/테스트용)
 * 빌드 시 생성된 keys.json을 public에 배포하지 않고
 * 환경변수나 별도 경로에서 로드
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

  if (!keyData) {
    keyData = await getDemoKey(bookId);
  }

  if (!keyData) {
    throw new Error('DECRYPTION_KEY_NOT_FOUND');
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
