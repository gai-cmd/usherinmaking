import type { Locale } from '@/lib/i18n';

/**
 * 작품 그리드(홈·스튜디오·로케이션) 한 칸의 **클라이언트 안전한** 표현.
 *
 * 선별 자체(DB 조회·폴백 판단)는 `@/server/works` 가 한다. 그 모듈은 Prisma 를
 * 끌고 오므로 클라이언트 컴포넌트가 타입 하나 때문에 import 하면 브라우저 번들이
 * 깨진다. image-slot.ts 와 같은 경계 규칙 — 서버가 만들어 넘긴 값을 화면이 읽을 때
 * 쓰는 모양만 여기에 둔다.
 */
export type WorkImage = { src: string; alt: Record<Locale, string> };
