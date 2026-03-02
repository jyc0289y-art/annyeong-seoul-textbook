/**
 * 접근 코드 서비스
 * Firebase 설정 시: Firestore에서 검증 + 접근 권한 관리
 * 데모 모드: 로컬 검증 (기존 방식)
 *
 * Firestore 컬렉션 구조:
 *   accessCodes/{codeId} - 접근 코드 목록
 *   userAccess/{userId_bookId} - 사용자별 접근 권한
 */
import { isFirebaseConfigured } from '../firebase.js';
import { isAdminLoggedIn, isStudentViewEnabled } from './admin-service.js';

/**
 * Firestore에서 접근 코드 검증
 * @param {string} bookId - 교재 ID (빈 문자열이면 전체 교재)
 * @param {string} code - 입력된 접근 코드
 * @param {string} userId - 사용자 UID
 * @returns {boolean} 검증 성공 여부
 */
async function verifyCodeFirestore(bookId, code, userId) {
  try {
    const { collection, query, where, getDocs, doc, setDoc, updateDoc, increment, serverTimestamp } = await import('firebase/firestore');
    const { db } = await import('../firebase.js');

    if (!db) return false;

    // 1. accessCodes 컬렉션에서 코드 검색
    //    - 특정 교재용 코드: bookId 일치 + active=true
    //    - 만능 코드: bookId="" + active=true
    const codesRef = collection(db, 'accessCodes');
    const q = query(
      codesRef,
      where('code', '==', code),
      where('active', '==', true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(`[AccessCode] Code not found or inactive: ${code}`);
      return false;
    }

    // 2. 유효한 코드 찾기 (bookId 일치 또는 만능 코드)
    let validCodeDoc = null;
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.bookId === bookId || data.bookId === '') {
        // maxUses 확인 (0이면 무제한)
        if (data.maxUses === 0 || data.currentUses < data.maxUses) {
          validCodeDoc = { id: docSnap.id, ...data };
        }
      }
    });

    if (!validCodeDoc) {
      console.log(`[AccessCode] Code expired or max uses reached: ${code}`);
      return false;
    }

    // 3. currentUses 증가
    const codeDocRef = doc(db, 'accessCodes', validCodeDoc.id);
    await updateDoc(codeDocRef, {
      currentUses: increment(1)
    });

    // 4. userAccess에 접근 권한 기록
    const accessDocId = `${userId}_${bookId}`;
    await setDoc(doc(db, 'userAccess', accessDocId), {
      userId: userId,
      bookId: bookId,
      code: code,
      grantedAt: serverTimestamp(),
      status: 'active'
    });

    console.log(`[AccessCode] Access granted via Firestore: ${bookId} for ${userId}`);
    return true;
  } catch (error) {
    console.error('[AccessCode] Firestore verification error:', error.message);
    return false;
  }
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
    const result = await verifyCodeFirestore(bookId, code, userId);
    if (result) return true;
    // Firestore 실패 시 데모 코드도 허용 (점진적 전환)
    return verifyCodeDemo(bookId, code);
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
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase.js');

      if (!db) return checkAccessLocal(bookId);

      // Firestore에서 접근 권한 확인
      const accessDocId = `${userId}_${bookId}`;
      const accessDoc = await getDoc(doc(db, 'userAccess', accessDocId));

      if (accessDoc.exists()) {
        const data = accessDoc.data();
        if (data.status === 'active') {
          return true;
        }
      }

      // Firestore에 없으면 로컬 스토리지도 확인 (하위 호환)
      return checkAccessLocal(bookId);
    } catch (error) {
      console.warn('[AccessCode] Firestore access check failed, using local:', error.message);
      return checkAccessLocal(bookId);
    }
  }

  return checkAccessLocal(bookId);
}

/**
 * 로컬 스토리지에서 접근 권한 확인 (데모/폴백)
 */
function checkAccessLocal(bookId) {
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
    try {
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../firebase.js');

      if (db) {
        const accessDocId = `${userId}_${bookId}`;
        await setDoc(doc(db, 'userAccess', accessDocId), {
          userId: userId,
          bookId: bookId,
          code: code,
          grantedAt: serverTimestamp(),
          status: 'active'
        });
        console.log(`[AccessCode] Access saved to Firestore: ${bookId}`);
      }
    } catch (error) {
      console.warn('[AccessCode] Firestore save failed, using local:', error.message);
    }
  }

  // 항상 로컬에도 저장 (오프라인/폴백용)
  const accessStore = JSON.parse(localStorage.getItem('sl_access') || '{}');
  accessStore[bookId] = { code, grantedAt: Date.now() };
  localStorage.setItem('sl_access', JSON.stringify(accessStore));
}
