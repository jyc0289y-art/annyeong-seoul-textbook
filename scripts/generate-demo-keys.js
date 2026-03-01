/**
 * demo-keys.json 생성 스크립트
 * scripts/keys.json → public/demo-keys.json 복사
 * 관리자 모드에서 PDF 복호화에 사용
 *
 * ⚠️ public/demo-keys.json은 절대 Git에 커밋하지 않음 (.gitignore 등록)
 *
 * 사용법: node scripts/generate-demo-keys.js
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = join(__dirname, 'keys.json');
const destPath = join(__dirname, '..', 'public', 'demo-keys.json');

if (!existsSync(srcPath)) {
  console.error('❌ scripts/keys.json이 없습니다.');
  console.error('   먼저 npm run build:encrypt를 실행하세요.');
  process.exit(1);
}

const keys = JSON.parse(readFileSync(srcPath, 'utf8'));
writeFileSync(destPath, JSON.stringify(keys, null, 2));

console.log('✅ demo-keys.json 생성 완료');
console.log(`   경로: ${destPath}`);
console.log(`   교재 수: ${Object.keys(keys).length}권`);
console.log('');
console.log('⚠️  이 파일은 절대 Git에 커밋하지 마세요!');
