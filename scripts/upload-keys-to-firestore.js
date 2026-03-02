#!/usr/bin/env node
/**
 * Firestore 초기 데이터 업로드 스크립트
 *
 * 사용법:
 *   1. Firebase CLI 로그인: npx firebase login
 *   2. 스크립트 실행: node scripts/upload-keys-to-firestore.js
 *
 * 업로드 내용:
 *   - scripts/keys.json → encryptionKeys 컬렉션
 *   - 접근 코드 초기 데이터 → accessCodes 컬렉션
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Firebase Admin 초기화 (Application Default Credentials)
// firebase login 후 사용 가능
try {
  initializeApp({
    credential: applicationDefault(),
    projectId: 'annyeong-seoul'
  });
} catch (error) {
  console.error('Firebase Admin 초기화 실패!');
  console.error('먼저 "npx firebase login"으로 로그인하세요.');
  console.error(error.message);
  process.exit(1);
}

const db = getFirestore();

/**
 * 암호화 키 업로드
 */
async function uploadEncryptionKeys() {
  const keysPath = join(__dirname, 'keys.json');
  const keys = JSON.parse(readFileSync(keysPath, 'utf-8'));

  console.log('\n=== 암호화 키 업로드 ===');
  console.log(`교재 수: ${Object.keys(keys).length}`);

  for (const [bookId, keyData] of Object.entries(keys)) {
    await db.collection('encryptionKeys').doc(bookId).set({
      key: keyData.key,
      iv: keyData.iv,
      authTag: keyData.authTag,
      uploadedAt: FieldValue.serverTimestamp()
    });
    console.log(`  ✅ ${bookId}`);
  }

  console.log('암호화 키 업로드 완료!\n');
}

/**
 * 접근 코드 초기 데이터 업로드
 */
async function uploadAccessCodes() {
  console.log('=== 접근 코드 업로드 ===');

  // 교재별 접근 코드
  const bookIds = ['hangul', 'beginner', 'inter1', 'inter2', 'inter3', 'adv1', 'adv2', 'adv3', 'spinA', 'spinB', 'spinC'];

  for (const bookId of bookIds) {
    const code = bookId.toUpperCase() + '2024';
    const docId = `code_${bookId}`;

    await db.collection('accessCodes').doc(docId).set({
      code: code,
      bookId: bookId,
      active: true,
      maxUses: 0, // 0 = 무제한
      currentUses: 0,
      createdAt: FieldValue.serverTimestamp(),
      description: `${bookId} 교재 접근 코드`
    });
    console.log(`  ✅ ${code} → ${bookId}`);
  }

  // 만능 코드 (전체 교재 접근)
  await db.collection('accessCodes').doc('code_master').set({
    code: 'SEOULINK',
    bookId: '', // 빈 문자열 = 전체 교재
    active: true,
    maxUses: 0,
    currentUses: 0,
    createdAt: FieldValue.serverTimestamp(),
    description: '만능 접근 코드 (전체 교재)'
  });
  console.log(`  ✅ SEOULINK → 전체 교재`);

  console.log('접근 코드 업로드 완료!\n');
}

/**
 * 메인 실행
 */
async function main() {
  console.log('🔥 Firestore 초기 데이터 업로드 시작');
  console.log(`프로젝트: annyeong-seoul`);
  console.log(`대상: asia-northeast3 (Seoul)\n`);

  try {
    await uploadEncryptionKeys();
    await uploadAccessCodes();
    console.log('✨ 모든 데이터 업로드 완료!');
    console.log('\n다음 단계:');
    console.log('  1. Firebase Console에서 데이터 확인');
    console.log('  2. npx firebase deploy --only firestore:rules (보안 규칙 배포)');
    console.log('  3. npx firebase deploy --only firestore:indexes (인덱스 배포)');
  } catch (error) {
    console.error('업로드 실패:', error.message);
    process.exit(1);
  }
}

main();
