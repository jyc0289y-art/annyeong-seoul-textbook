/**
 * 접근 코드 서비스
 * Firebase 설정 시: Firestore에서 검증
 * 데모 모드: 로컬 검증 (기존 방식)
 */
import { isFirebaseConfigured } from '../firebase.js';
import { isAdminLoggedIn, isStudentViewEnabled } from './admin-service.js';

/**
 * Firestore에서 접근 코드 검증 (Firebase 설정 후 활성화)
 */
async function verifyCodeFirestore(bookId, code, userId) {
  // TODO: Firebase 프로젝트 설정 후 구현
  // const { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, increment } = await import('firebase/firestore');
  // const db = getFirestore();
  // 1. accessCodes 컬렉션에서 code + bookId + active=true 검색
  // 2. maxUses 확인, currentUses 증가
  // 3. userAccess에 접근 권한 기록
  return false;
}

/**
 * 데모 모드 접근 코드 검증
 * 코드 형식: BOOKID대문자 + 2024 (예: HANGUL2024)
 * 만능 코드: SEOULINK
 */
function verifyCodeDemo(bookId, code) {
  const demoCode = bookId.toUpperCase() + '2024';
  return code === demoCode || code === 'SEOULINK';
}

/**
 * 접근 코드 검증
 * @param {string} bookId - 교재 ID
 * @param {string} code - 입력된 접근 코드
 * @param {string} userId - 사용자 UID
 * @returns {boolean} 검증 성공 여부
 */
export async function verifyAccessCode(bookId, code, userId) {
  if (isFirebaseConfigured()) {
    return await verifyCodeFirestore(bookId, code, userId);
  }
  return verifyCodeDemo(bookId, code);
}

/**
 * 사용자의 접근 권한 확인
 * @param {string} bookId - 교재 ID
 * @param {string} userId - 사용자 UID
 * @returns {boolean}
 */
export async function checkAccess(bookId, userId) {
  // 관리자 모드: 학생 모드가 아니면 전체 접근 허용
  if (isAdminLoggedIn() && !isStudentViewEnabled()) {
    return true;
  }

  if (isFirebaseConfigured()) {
    // TODO: Firestore userAccess 컬렉션 확인
    return false;
  }

  // 데모 모드: localStorage 사용
  const accessStore = JSON.parse(localStorage.getItem('sl_access') || '{}');
  return !!accessStore[bookId];
}

/**
 * 접근 권한 저장
 * @param {string} bookId - 교재 ID
 * @param {string} code - 사용한 접근 코드
 * @param {string} userId - 사용자 UID
 */
export async function grantAccess(bookId, code, userId) {
  if (isFirebaseConfigured()) {
    // TODO: Firestore에 접근 권한 기록
    return;
  }

  // 데모 모드: localStorage에 저장
  const accessStore = JSON.parse(localStorage.getItem('sl_access') || '{}');
  accessStore[bookId] = { code, grantedAt: Date.now() };
  localStorage.setItem('sl_access', JSON.stringify(accessStore));
}
