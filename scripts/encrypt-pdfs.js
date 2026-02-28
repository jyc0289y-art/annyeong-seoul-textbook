/**
 * PDF 암호화 스크립트
 * 각 PDF를 AES-256-GCM으로 암호화하여 .enc 파일 생성
 * 교재별 개별 키를 생성하여 keys.json에 저장
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { randomBytes, createCipheriv } from 'crypto';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PDF_DIR = join(__dirname, '..', 'public', 'pdfs');
const ENC_DIR = join(__dirname, '..', 'public', 'pdfs-encrypted');
const KEYS_FILE = join(__dirname, 'keys.json');

function encryptPdf(pdfPath, bookId) {
  const pdfData = readFileSync(pdfPath);

  // 교재별 고유 키 생성
  const key = randomBytes(32); // 256비트
  const iv = randomBytes(12);  // 96비트 (GCM 권장)

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(pdfData), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16바이트 인증 태그

  // 파일 형식: [12바이트 IV] + [16바이트 authTag] + [암호화 데이터]
  const output = Buffer.concat([iv, authTag, encrypted]);

  return {
    encryptedData: output,
    key: key.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    originalSize: pdfData.length,
    encryptedSize: output.length
  };
}

function main() {
  console.log('=== PDF 암호화 시작 ===\n');

  // 출력 디렉토리 생성
  if (!existsSync(ENC_DIR)) {
    mkdirSync(ENC_DIR, { recursive: true });
  }

  // PDF 파일 목록
  const pdfFiles = readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    console.error('❌ public/pdfs/ 에 PDF 파일이 없습니다.');
    process.exit(1);
  }

  const keys = {};

  for (const pdfFile of pdfFiles) {
    const bookId = basename(pdfFile, '.pdf');
    const pdfPath = join(PDF_DIR, pdfFile);

    console.log(`🔐 암호화 중: ${pdfFile}`);

    const result = encryptPdf(pdfPath, bookId);

    // 암호화된 파일 저장
    const encPath = join(ENC_DIR, `${bookId}.enc`);
    writeFileSync(encPath, result.encryptedData);

    // 키 저장
    keys[bookId] = {
      key: result.key,
      iv: result.iv,
      authTag: result.authTag
    };

    const ratio = ((result.encryptedSize / result.originalSize) * 100).toFixed(1);
    console.log(`   ✅ ${bookId}.enc (${(result.encryptedSize / 1024).toFixed(0)}KB, ${ratio}%)`);
  }

  // 키 파일 저장 (gitignore 대상!)
  writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
  console.log(`\n🔑 키 저장: scripts/keys.json (${Object.keys(keys).length}개 교재)`);
  console.log('⚠️  keys.json은 절대 Git에 커밋하지 마세요!');
  console.log('\n=== 암호화 완료 ===');
}

main();
