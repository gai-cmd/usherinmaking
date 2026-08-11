// 수집 제외 목록.
//
// "삭제"만으로는 인스타 동기화가 돌 때 같은 사진이 다시 들어온다 — 중복 방지가
// "이미 가진 사진인가"를 Photo 행으로 판단하기 때문에, 행을 지우면 그 사진은 다시 새 사진이 된다.
// 그래서 지울 때 그 인스타 media id 를 여기에 적어 두고, 수집이 목록을 먼저 걸러 낸다.
//
// 저장소는 Setting 테이블 한 칸(JSON 배열)이다. 전용 테이블을 만들지 않은 이유는
// 스키마 변경 없이 끝나기 때문이고, 제외 목록은 많아야 수백 건이라 한 칸으로 충분하다.

import { isDatabaseConfigured, prisma } from '@/server/db';

const KEY = 'ig-blocklist';

/** 제외된 인스타 media id 전체. DB 가 없거나 읽기 실패면 빈 집합 — 제외를 수집 실패로 바꾸지 않는다. */
export async function blockedIgMediaIds(): Promise<Set<string>> {
  if (!isDatabaseConfigured()) return new Set();
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY }, select: { value: true } });
    if (!row) return new Set();
    const parsed = JSON.parse(row.value);
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    // 목록을 못 읽었다고 수집을 멈추지 않는다. 최악의 경우 지운 사진이 한 번 더 들어올 뿐이고,
    // 그건 다시 제외하면 된다 — 수집 전체가 멎는 것보다 낫다.
    return new Set();
  }
}

/** 목록에 추가한다. 이미 있는 id 는 그대로 둔다. 추가된 뒤의 전체 건수를 돌려준다. */
export async function blockIgMediaIds(ids: string[]): Promise<number> {
  const next = await blockedIgMediaIds();
  for (const id of ids) if (id) next.add(id);
  const value = JSON.stringify([...next]);
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  return next.size;
}

/** 목록에서 뺀다. 실수로 제외한 사진을 다시 받고 싶을 때 쓴다. */
export async function unblockIgMediaIds(ids: string[]): Promise<number> {
  const next = await blockedIgMediaIds();
  for (const id of ids) next.delete(id);
  const value = JSON.stringify([...next]);
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  return next.size;
}
