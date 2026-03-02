/**
 * Firebase 초기화
 * 환경변수(VITE_FIREBASE_*)가 설정되면 실제 Firebase에 연결
 * 미설정 시 데모 모드로 동작 (개발/테스트용)
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Firebase가 설정되지 않은 경우 더미 모드로 동작
const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

let app = null;
let auth = null;
let db = null;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('[Firebase] Initialized with project:', firebaseConfig.projectId);
  } catch (error) {
    console.warn('[Firebase] Initialization failed, falling back to demo mode:', error.message);
  }
} else {
  console.log('[Firebase] No config found, running in demo mode');
}

// 현재 사용자 상태
let currentUser = null;
const authListeners = new Set();

export function onAuthChange(callback) {
  authListeners.add(callback);

  if (auth) {
    // 첫 번째 리스너만 onAuthStateChanged 등록
    if (authListeners.size === 1) {
      onAuthStateChanged(auth, (user) => {
        currentUser = user;
        authListeners.forEach(cb => cb(user));
      });
    } else {
      // 이미 등록된 경우, 현재 상태로 즉시 콜백
      callback(currentUser);
    }
  }

  return () => {
    authListeners.delete(callback);
  };
}

export async function loginWithGoogle() {
  if (!auth) return demoLogin();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function loginWithApple() {
  if (!auth) return demoLogin();
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logout() {
  if (auth) await signOut(auth);
  currentUser = null;
  authListeners.forEach(cb => cb(null));
}

export function getCurrentUser() {
  return currentUser;
}

export function isFirebaseConfigured() {
  return isConfigured;
}

// Firebase 미설정 시 데모 로그인
function demoLogin() {
  currentUser = {
    uid: 'demo-user-001',
    displayName: 'Demo User',
    email: 'demo@example.com',
    photoURL: null
  };
  authListeners.forEach(cb => cb(currentUser));
  return currentUser;
}

export { auth, db };
