/**
 * 미리보기 PDF 추출 스크립트
 * 각 교재의 첫 3페이지만 추출하여 소형 PDF로 저장
 * pdf-lib 사용 (순수 JS, 네이티브 의존성 없음)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { PDFDocument } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PDF_DIR = join(__dirname, '..', 'public', 'pdfs');
const PREVIEW_DIR = join(__dirname, '..', 'public', 'previews');
const PREVIEW_PAGES = 3; // 미리보기 페이지 수

async function extractPreview(pdfPath, bookId) {
  const pdfBytes = readFileSync(pdfPath);
  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();
  const pagesToExtract = Math.min(PREVIEW_PAGES, totalPages);

  // 새 PDF 문서 생성
  const previewDoc = await PDFDocument.create();

  // 첫 N페이지 복사
  const pageIndices = Array.from({ length: pagesToExtract }, (_, i) => i);
  const copiedPages = await previewDoc.copyPages(srcDoc, pageIndices);

  for (const page of copiedPages) {
    previewDoc.addPage(page);
  }

  const previewBytes = await previewDoc.save();

  return {
    data: previewBytes,
    totalPages,
    previewPages: pagesToExtract,
    originalSize: pdfBytes.length,
    previewSize: previewBytes.length
  };
}

async function main() {
  console.log('=== 미리보기 PDF 추출 시작 ===\n');

  // 출력 디렉토리 생성
  if (!existsSync(PREVIEW_DIR)) {
    mkdirSync(PREVIEW_DIR, { recursive: true });
  }

  // PDF 파일 목록
  const pdfFiles = readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    console.error('❌ public/pdfs/ 에 PDF 파일이 없습니다.');
    process.exit(1);
  }

  const manifest = {};

  for (const pdfFile of pdfFiles) {
    const bookId = basename(pdfFile, '.pdf');
    const pdfPath = join(PDF_DIR, pdfFile);

    console.log(`📄 추출 중: ${pdfFile}`);

    const result = await extractPreview(pdfPath, bookId);

    // 미리보기 PDF 저장
    const previewPath = join(PREVIEW_DIR, `${bookId}-preview.pdf`);
    writeFileSync(previewPath, result.data);

    manifest[bookId] = {
      previewFile: `${bookId}-preview.pdf`,
      previewPages: result.previewPages,
      totalPages: result.totalPages
    };

    const sizeKB = (result.previewSize / 1024).toFixed(0);
    const ratio = ((result.previewSize / result.originalSize) * 100).toFixed(1);
    console.log(`   ✅ ${bookId}-preview.pdf (${sizeKB}KB, ${ratio}% of original, ${result.previewPages}/${result.totalPages} pages)`);
  }

  // 매니페스트 저장
  const manifestPath = join(PREVIEW_DIR, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n📋 매니페스트: public/previews/manifest.json`);
  console.log('\n=== 미리보기 추출 완료 ===');
}

main().catch(err => {
  console.error('❌ 에러:', err);
  process.exit(1);
});
