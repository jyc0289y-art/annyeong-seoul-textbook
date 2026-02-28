// Firebase 초기화
// TODO: Firebase 프로젝트 생성 후 아래 config를 실제 값으로 교체하세요
// https://console.firebase.google.com/ 에서 프로젝트 생성

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase가 설정되지 않은 경우 더미 모드로 동작
const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY";

let app = null;
let auth = null;
let db = null;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

// 현재 사용자 상태
let currentUser = null;
const authListeners = [];

export function onAuthChange(callback) {
  authListeners.push(callback);
  if (auth) {
    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      authListeners.forEach(cb => cb(user));
    });
  }
  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx > -1) authListeners.splice(idx, 1);
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
