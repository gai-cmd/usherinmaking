// 인스타 캡션 → 사이트용 정제 텍스트.
//
// 캡션 전문(평균 450자)은 절반 이상이 해시태그·멘션 덩어리다. 그대로 본문·메타 설명에 넣으면
// 검색엔진에는 키워드 나열(keyword stuffing) 신호가 되고, AI 답변 엔진이 인용할 문장도 없다.
// 여기서 "사람이 쓴 문장"과 "태그"를 분리한다 — 문장은 고쳐 쓰지 않고 태그만 걷어내는 것이
// "원문 그대로"의 경계다. 원문 전문은 DB 의 caption 컬럼에 그대로 남아 있으므로 손실은 없다.

/** 해시태그 토큰. #沖縄前撮り 처럼 CJK 도 잡는다. 공백·다음 # 전까지가 태그다. */
const HASHTAG = /#[^\s#@]+/g;

/** 멘션 토큰. 문장 안의 @usherindress 는 이름만 남긴다 — SNS 관용구를 본문에 남기지 않는다. */
const MENTION = /@([\w.]+)/g;

export type ParsedCaption = {
  /** 해시태그·멘션을 걷어낸 본문. 문장 자체는 원문 그대로다. */
  body: string;
  /** 등장 순서 그대로, 중복 제거된 해시태그(# 제외). */
  hashtags: string[];
  /** 본문에 등장한 멘션 계정명(@ 제외). */
  mentions: string[];
};

/** 한 줄이 해시태그·멘션·구두점만으로 이루어져 있는가 — 그런 줄은 본문이 아니다. */
function isTagOnlyLine(line: string): boolean {
  const rest = line.replace(HASHTAG, '').replace(MENTION, '').replace(/[\s・,、/|~〜!！?？.。-]+/g, '');
  return rest.length === 0;
}

export function parseCaption(caption: string | null | undefined): ParsedCaption {
  if (!caption) return { body: '', hashtags: [], mentions: [] };

  const hashtags: string[] = [];
  const seen = new Set<string>();
  for (const m of caption.matchAll(HASHTAG)) {
    const tag = m[0].slice(1);
    if (!seen.has(tag)) {
      seen.add(tag);
      hashtags.push(tag);
    }
  }

  const mentions: string[] = [];
  const seenM = new Set<string>();
  for (const m of caption.matchAll(MENTION)) {
    if (!seenM.has(m[1])) {
      seenM.add(m[1]);
      mentions.push(m[1]);
    }
  }

  const body = caption
    .split('\n')
    .filter((line) => line.trim() && !isTagOnlyLine(line))
    .map((line) =>
      line
        .replace(HASHTAG, '') // 문장 끝에 붙은 인라인 태그도 걷는다
        .replace(MENTION, '$1') // @계정 → 계정명만
        .replace(/[ \t]{2,}/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n');

  return { body, hashtags, mentions };
}

/** 검색 결과·OG 설명용 한 문단. 해시태그 없는 본문을 길이에 맞게 자른다. */
export function captionDescription(caption: string | null | undefined, max = 160): string {
  const body = parseCaption(caption).body.replace(/\s+/g, ' ').trim();
  return body.length > max ? `${body.slice(0, max - 1)}…` : body;
}

/**
 * 화면·구조화 데이터에 내보일 태그. 수십 개를 다 싣으면 그게 다시 키워드 나열이 되므로
 * 앞에서부터 소수만 쓴다 — 작성자가 앞에 둔 태그가 그 게시물의 핵심이다.
 */
export function topHashtags(caption: string | null | undefined, limit = 8): string[] {
  return parseCaption(caption).hashtags.slice(0, limit);
}
