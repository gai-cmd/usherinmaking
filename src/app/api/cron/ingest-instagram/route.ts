import { newIngestRun, recordActivity, saveIngestRun, type IngestRun } from '@/server/activity';
import { requireCronSecret } from '@/server/auth';
import { AppError, DependencyUnavailableError, errorResponse } from '@/server/errors';
import {
  createIngestedPhotos,
  knownIgMediaIds,
  type IngestCandidate,
} from '@/server/photos';
import {
  downloadOriginal,
  draftAltText,
  encodeRenditions,
  fetchInstagramMedia,
  isLowRes,
  missingPipelineEnv,
  originalKey,
  planRenditions,
  storeOriginal,
  suggestCategories,
  type InstagramMedia,
} from '@/lib/image-pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 6시간마다 — vercel.json의 crons 항목이 이 경로를 가리킨다.
export const maxDuration = 300;

/**
 * 인스타그램 전량 수집 크론.
 *
 * 흐름: 크론 시크릿 검증 → 환경변수 확인 → 게시물 목록 조회 → 신규만 원본 다운로드
 *      → 스토리지 보관 → AVIF/WebP 재인코딩 → AI 분류·alt 초안 → UNSORTED로 저장.
 *
 * 지금 상태: 인스타 토큰 · 오브젝트 스토리지 · AI 제공자가 모두 없다.
 * 그래서 이 라우트는 절대 성공을 반환하지 않는다. 어디서 막혔는지를 IngestRun에 남기고
 * 503(의존성 없음) 또는 501(구현 없음)로 끝난다. 수집 성공을 가장하지 않는 것이 이 파일의 핵심 계약이다.
 */
export async function GET(req: Request) {
  const run: IngestRun = newIngestRun();

  try {
    // 1) 가드가 먼저다. 시크릿이 없으면 낯선 사람이 수집을 돌릴 수 있다.
    await requireCronSecret(req);

    // 2) 자격증명 확인. 없으면 여기서 정직하게 끊는다.
    const missing = missingPipelineEnv();
    if (missing.length > 0) {
      throw new DependencyUnavailableError(
        `인스타그램 수집에 필요한 환경변수가 없습니다: ${missing.join(', ')}`,
        { missingEnv: missing },
      );
    }

    const creds = {
      accessToken: process.env.IG_ACCESS_TOKEN as string,
      userId: process.env.IG_USER_ID as string,
    };

    // 3) 전량 조회. 상한을 두지 않는 것이 수집 원칙이다.
    const media: InstagramMedia[] = await fetchInstagramMedia(creds);
    run.fetched = media.length;

    // 4) 신규만 내려받는다 — igMediaId가 중복 방지 키다.
    const known = await knownIgMediaIds();
    const fresh = media.filter((m) => !known.has(m.id));

    const candidates: IngestCandidate[] = [];
    for (const m of fresh) {
      try {
        const bytes = await downloadOriginal(m.mediaUrl);
        const original = await storeOriginal(originalKey(m.id, 'jpg'), bytes);

        const plan = planRenditions({ id: m.id, width: m.width, height: m.height });
        const encoded = await encodeRenditions(bytes, plan);

        const [suggestions, alt] = await Promise.all([
          suggestCategories(bytes),
          draftAltText(bytes, m.caption),
        ]);

        candidates.push({
          igMediaId: m.id,
          originalUrl: original,
          // encodeRenditions가 업로드까지 마친 뒤 buildVariantMap 형태로 돌려준다.
          variants: encoded,
          width: m.width,
          height: m.height,
          caption: m.caption,
          takenAt: new Date(m.timestamp),
          // AI 초안일 뿐이다. 관리자가 확인하기 전에는 UNSORTED이므로 프론트에 나가지 않는다.
          alt,
          aiSuggestion: suggestions.map((sg) => ({
            taxonomyId: sg.taxonomyKey,
            termId: sg.termSlug,
            label: sg.termSlug,
            score: sg.score,
          })),
        });

        // 저해상도 판정은 순수 함수라 지금도 정확하다.
        if (isLowRes(m.width, m.height)) {
          console.warn('[ingest] 저해상도 원본', m.id, `${m.width}x${m.height}`);
        }
      } catch (itemErr) {
        run.failed += 1;
        console.error('[ingest] 항목 실패', m.id, itemErr);
      }
    }

    // 5) 전부 UNSORTED로 저장. 전시는 관리자가 고른 것만.
    run.created = await createIngestedPhotos(candidates);
    run.finishedAt = new Date();
    await saveIngestRun(run);
    await recordActivity({
      actor: 'system',
      action: `Instagram 동기화 — 신규 ${run.created}건 수집`,
      detail: { fetched: run.fetched, created: run.created, failed: run.failed },
    });

    return Response.json({ run });
  } catch (err) {
    // 실패도 실행 기록이다. 중복·누락 판별의 근거이므로 남기고 나간다.
    run.finishedAt = new Date();
    run.error = err instanceof Error ? err.message : String(err);
    await saveIngestRun(run);

    if (err instanceof AppError) {
      return Response.json(
        {
          error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
          run,
        },
        { status: err.status },
      );
    }
    return errorResponse(err);
  }
}
