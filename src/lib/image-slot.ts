import type { Locale } from '@/lib/i18n';

/**
 * 페이지 이미지 슬롯의 **클라이언트 안전한** 표현.
 *
 * 해석 자체는 `@/server/page-images` 가 한다. 그 모듈은 Prisma 를 끌고 오므로
 * 클라이언트 컴포넌트가 타입 하나 때문에 import 하면 브라우저 번들이 깨진다.
 * 그래서 서버가 만들어 넘긴 값을 화면이 읽을 때 쓰는 모양만 여기에 둔다.
 * page-images 의 ResolvedImage 는 이 타입에 구조적으로 대입 가능하다.
 */
export type SlotImage = {
  url: string;
  width: number | null;
  height: number | null;
  /** DB 행에서 온 3개 언어 alt. 폴백일 때는 null 이며 화면이 자기 카피의 alt 를 쓴다. */
  alt: Record<Locale, string> | null;
  source: 'db' | 'fallback';
};

/** resolvePageImages() 의 반환. 슬롯 키 → 값, 값이 null 이면 그 자리는 그리지 않는다. */
export type PageImageMap = Record<string, SlotImage | null>;

/** 화면이 <Image> 에 그대로 펼쳐 넣을 수 있는 모양. */
export type PickedImage = {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
};

/**
 * 슬롯 하나를 화면이 쓸 값으로 좁힌다.
 *
 * 세 가지 상태를 한곳에서 정리한다:
 *   1. 관리자가 건 사진이 있다     → 그 URL + DB 의 해당 언어 alt
 *   2. 아직 없고 코드 폴백이 있다  → 폴백 URL + 화면이 원래 쓰던 alt
 *   3. 둘 다 없다                  → null. 호출부가 그 자리를 렌더하지 않는다
 *
 * `images` 를 옵셔널로 받는 이유: 아직 배선되지 않은 호출부가 남아 있어도
 * 폴백 인자만으로 지금과 똑같이 동작하게 하기 위해서다.
 */
export function pickImage(
  images: PageImageMap | undefined,
  slot: string,
  locale: Locale,
  fallbackSrc: string | null,
  fallbackAlt: string,
): PickedImage | null {
  const resolved = images?.[slot];

  if (resolved && resolved.source === 'db') {
    return {
      src: resolved.url,
      // alt 가 3개 언어로 채워지지 않은 행은 해석기가 이미 걸러 낸다. 그래도 방어적으로 폴백을 남긴다.
      alt: resolved.alt?.[locale] ?? fallbackAlt,
      width: resolved.width,
      height: resolved.height,
    };
  }

  // 해석기가 준 폴백이 있으면 그걸 쓰고, 없으면 호출부가 넘긴 현재 경로를 쓴다.
  const src = resolved?.url ?? fallbackSrc;
  if (!src) return null;

  return { src, alt: fallbackAlt, width: resolved?.width ?? null, height: resolved?.height ?? null };
}
