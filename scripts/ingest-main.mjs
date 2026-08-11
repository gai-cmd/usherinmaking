// 작품 계정(main) 수집을 로컬에서 즉시 돌리는 도구.
//
// 프로덕션에 CRON_SECRET 이 없어 크론 엔드포인트를 밖에서 부를 수 없을 때,
// 본체 파이프라인(runInstagramIngest)을 그대로 로컬에서 실행한다 —
// DB(Neon)·Blob 모두 .env.local 의 프로덕션 자격 증명을 쓰므로 결과는 크론과 같다.
//
// 실행:
//   node scripts/ingest-main.mjs --preview        → 몇 건이 새로 들어올지만 (쓰기 없음)
//   node scripts/ingest-main.mjs [--limit 25]     → 수집 (UNSORTED 로 저장)

import path from 'node:path';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const ROOT = process.cwd();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return {
        url: pathToFileURL(path.join(ROOT, 'src', `${specifier.slice(2)}.ts`)).href,
        shortCircuit: true,
      };
    }
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      try {
        return nextResolve(specifier, context);
      } catch (err) {
        if (path.extname(specifier) === '') return nextResolve(`${specifier}.ts`, context);
        throw err;
      }
    }
    return nextResolve(specifier, context);
  },
});

const args = process.argv.slice(2);
const PREVIEW = args.includes('--preview');
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || 25;

const { previewInstagramIngest, runInstagramIngest } = await import('@/server/ingest');

if (PREVIEW) {
  const p = await previewInstagramIngest();
  console.log(`전체 ${p.fetched}건 · 보유 ${p.known}건 · 신규 ${p.fresh}건`);
  process.exit(0);
}

const result = await runInstagramIngest({ trigger: 'admin', actor: 'local-script', maxItems: LIMIT });
const { run } = result;
console.log(
  result.ok ? '완료' : `실패: ${result.error.message}`,
  `— fetched=${run.fetched} created=${run.created} failed=${run.failed} skipped=${result.skipped} remaining=${result.remaining}`,
);
process.exit(result.ok ? 0 : 1);
