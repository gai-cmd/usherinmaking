# usherinmaking — CMS / DB 배선 브리핑

`.moai/handoff/BRIEF.md` 와 `BRIEF-ADMIN.md` 를 먼저 읽어라. 이 파일은 그 위에 얹는 현재 상태다.

## 지금 무엇이 달라졌나

**DB가 실제로 붙었다.** 더 이상 스텁이 아니다.

- Neon Postgres (`usherinmaking-db`, free, ap-southeast-1) 가 Vercel 프로젝트에 연결됨
- `DATABASE_URL` / `DATABASE_URL_UNPOOLED` 가 production·preview·development 에 주입됨
- 로컬은 `.env.local` 에 이미 내려받아 있다 (`vercel env pull` 로 갱신)
- `prisma/schema.prisma` 의 모든 모델이 `prisma db push` 로 반영 완료
- Prisma 7 이다. 접속 URL은 스키마가 아니라 `prisma.config.ts` + 어댑터가 들고 있다

**런타임 클라이언트**: `src/server/db.ts`

```ts
import { isDatabaseConfigured, prisma } from '@/server/db';
```

Neon 서버리스 어댑터를 쓴다. 새 PrismaClient 를 직접 만들지 말고 이 싱글턴만 써라.

**이미 배선 끝난 것** (참고 패턴으로 삼아라):

- `src/app/api/contact/route.ts` — 문의를 `prisma.inquiry.create` 로 저장. 저장 실패 시 503, 알림 실패는 접수 성공을 뒤집지 않는다
- `src/server/inquiries.ts` — 읽기 4개 + 상태/메모 쓰기. **DB 우선, 시드 폴백** 패턴

### DB 우선 · 시드 폴백 패턴 (이걸 따라라)

```ts
if (isDatabaseConfigured()) {
  const rows = await prisma.x.findMany({ ... });
  if (rows.length > 0) return rows.map(fromDb);
}
return SEED_X.filter(...);   // 코드에 있던 기존 시드
```

이유: `DATABASE_URL` 이 없는 환경에서 관리자가 빈 화면만 보는 것보다 구조라도 보이는 편이 낫다.
**실데이터가 있으면 언제나 DB가 이긴다.** 시드를 지우지 마라.

## 새로 생긴 모델

```
PageContent   page + slot + locale → value   (문구 덮어쓰기; 행이 없으면 코드 기본값)
PageImage     page + slot → url, width, height, alt{ja,en,ko}
MediaAsset    업로드된 원본 (source: manual | instagram)
```

**PageContent 는 덮어쓰기 레이어다.** 원본 카피는 `src/content/*` 와 각 페이지 `content.ts` 에
그대로 둔다. 행이 있으면 그 값이 이기고 없으면 코드 값이 나간다. 통째로 DB로 옮기지 마라 —
행 하나가 비면 화면이 빈칸이 되는 상태를 만들지 않기 위해서다.

## 스토리지

`BLOB_READ_WRITE_TOKEN` 이 이미 프로젝트에 있다. `@vercel/blob` 설치돼 있다.
`sharp` 도 설치돼 있다 (AVIF/WebP 재인코딩용).

## 절대 지킬 것

- `prisma/schema.prisma` 는 **오케스트레이터가 소유**한다. 모델 추가가 필요하면 직접 고치지 말고
  최종 보고에 적어라. 여러 에이전트가 동시에 고치면 push 가 깨진다
- `src/server/db.ts` 도 오케스트레이터 소유. import 만 해라
- 쓰기 경로가 아직 안 붙은 화면은 **성공한 척하지 마라** — 기존 `NotImplementedError` 규약 유지
- 고객 이메일 원문은 캐시·색인될 수 있는 출력에 절대 넣지 마라 (`maskEmail` 사용)
- 관리자 페이지는 **페이지 컴포넌트 첫 줄에서** `checkAdminPageAccess()` + `notFound()`.
  레이아웃 가드만으로는 자식 실행을 못 막는다 (실측으로 확인된 사항이다)

## 검증

```
npx tsc --noEmit
npm run build
```

실제로 돌린 출력만 보고해라. 다른 에이전트의 작업 중 파일에서 나온 오류는 네 것이 아니라고 명시하고 구분해라.
