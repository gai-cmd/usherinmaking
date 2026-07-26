'use client';

import { useState } from 'react';
import { AdminButton, Badge, Panel, WriteResultNotice } from '@/components/admin';
import { LOCALES, LOCALE_LABEL, type Locale } from '@/lib/i18n';
import type { JournalCategory } from '@/content/journal';
import s from './post.module.css';

/**
 * 촬영후기 상세 화면의 저장 · 게시를 담당하는 클라이언트 컴포넌트.
 *
 * 저장/게시는 slug + locale 단위 레코드로 동작한다(@/server/journal 의
 * upsertJournalPost · publishJournalPost 참고). 그래서 버튼도 언어 패널마다 따로 둔다 —
 * 세 언어를 "게시" 버튼 하나로 묶으면 한 언어만 실패했을 때 그 실패를 감추게 된다.
 *
 * 이 화면은 title · body만 편집한다. 커버 이미지는 사진 파이프라인(별도 작업 중)의
 * 영역이라 손대지 않는다 — 값이 없으면 없다고 그대로 보여준다.
 */

export type LocalePostSnapshot = {
  title: string;
  body: string;
  cover: string;
  published: boolean;
} | null;

type Props = {
  slug: string;
  category: JournalCategory;
  planCode: string | null;
  /** 샘플 표시. 저장 시 그대로 유지한다 — 이 화면에서 해제 버튼을 두지 않는다. */
  isSample: boolean;
  posts: Record<Locale, LocalePostSnapshot>;
};

type Draft = { title: string; body: string };
type Status =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'saved' }
  | { kind: 'failed'; message: string };

type ApiResult =
  | { ok: true; status: 'draft' | 'published' }
  | { ok: false; message: string };

async function callJournalApi(method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<ApiResult> {
  try {
    const res = await fetch('/api/admin/journal', {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = (await res.json().catch(() => null)) as
      | { status?: 'draft' | 'published'; error?: { message?: string } }
      | null;
    if (!res.ok) {
      return { ok: false, message: payload?.error?.message ?? `요청이 실패했습니다 (${res.status}).` };
    }
    return { ok: true, status: payload?.status ?? 'draft' };
  } catch {
    return { ok: false, message: '서버에 연결하지 못했습니다.' };
  }
}

export function JournalPostEditor({ slug, category, planCode, isSample, posts }: Props) {
  const [drafts, setDrafts] = useState<Record<Locale, Draft>>(
    () =>
      Object.fromEntries(
        LOCALES.map((l) => [l, { title: posts[l]?.title ?? '', body: posts[l]?.body ?? '' }]),
      ) as Record<Locale, Draft>,
  );
  // 레코드가 실제로 존재하는지(=게시 가능한지)는 저장 성공 여부로 갱신한다.
  const [exists, setExists] = useState<Record<Locale, boolean>>(
    () => Object.fromEntries(LOCALES.map((l) => [l, posts[l] !== null])) as Record<Locale, boolean>,
  );
  const [published, setPublished] = useState<Record<Locale, boolean>>(
    () => Object.fromEntries(LOCALES.map((l) => [l, posts[l]?.published ?? false])) as Record<Locale, boolean>,
  );
  const [status, setStatus] = useState<Record<Locale, Status>>(
    () => Object.fromEntries(LOCALES.map((l) => [l, { kind: 'idle' as const }])) as Record<Locale, Status>,
  );

  const setDraft = (locale: Locale, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [locale]: { ...prev[locale], ...patch } }));
  const setStatusFor = (locale: Locale, next: Status) =>
    setStatus((prev) => ({ ...prev, [locale]: next }));

  async function save(locale: Locale) {
    const draft = drafts[locale];
    if (!draft.title.trim()) {
      setStatusFor(locale, { kind: 'failed', message: '제목을 입력해야 저장할 수 있습니다.' });
      return;
    }
    setStatusFor(locale, { kind: 'pending' });
    const result = await callJournalApi('POST', {
      slug,
      locale,
      category,
      title: draft.title,
      body: draft.body,
      // 커버는 이 화면에서 바꾸지 않는다 — 있던 값 그대로 다시 보낸다.
      cover: posts[locale]?.cover ?? '',
      planCode,
      isSample,
    });
    if (!result.ok) {
      setStatusFor(locale, { kind: 'failed', message: result.message });
      return;
    }
    setExists((prev) => ({ ...prev, [locale]: true }));
    setStatusFor(locale, { kind: 'saved' });
  }

  async function togglePublish(locale: Locale) {
    setStatusFor(locale, { kind: 'pending' });
    const action = published[locale] ? 'unpublish' : 'publish';
    const result = await callJournalApi('PATCH', { action, slug, locale });
    if (!result.ok) {
      setStatusFor(locale, { kind: 'failed', message: result.message });
      return;
    }
    setPublished((prev) => ({ ...prev, [locale]: result.status === 'published' }));
    setStatusFor(locale, { kind: 'saved' });
  }

  return (
    <div className={s.langGrid}>
      {LOCALES.map((locale) => {
        const draft = drafts[locale];
        const state = status[locale];
        const busy = state.kind === 'pending';
        const has = exists[locale];
        const isPublished = published[locale];
        const cover = posts[locale]?.cover ?? '';
        const initial = posts[locale];
        const dirty = draft.title !== (initial?.title ?? '') || draft.body !== (initial?.body ?? '');

        return (
          <Panel
            key={locale}
            title={LOCALE_LABEL[locale]}
            aside={
              !has ? (
                <Badge tone="warn">본문 없음</Badge>
              ) : (
                <Badge tone={isPublished ? 'dark' : 'default'}>{isPublished ? '게시중' : '임시저장'}</Badge>
              )
            }
          >
            <div className={s.postBody}>
              {!has ? (
                <p className={s.missing}>
                  이 언어의 본문이 아직 없습니다. 다른 언어를 번역해 채우는 것이 아니라, 이 언어의
                  독자에게 맞는 글을 따로 씁니다.
                </p>
              ) : null}

              <input
                className={s.titleInput}
                value={draft.title}
                maxLength={200}
                disabled={busy}
                placeholder="제목"
                lang={locale}
                onChange={(e) => {
                  setDraft(locale, { title: e.target.value });
                  setStatusFor(locale, { kind: 'idle' });
                }}
              />
              <textarea
                className={s.bodyTextarea}
                value={draft.body}
                maxLength={20000}
                rows={10}
                disabled={busy}
                placeholder="본문 (빈 줄로 문단을 구분합니다)"
                lang={locale}
                onChange={(e) => {
                  setDraft(locale, { body: e.target.value });
                  setStatusFor(locale, { kind: 'idle' });
                }}
              />

              <p className={s.cover}>
                커버{' '}
                {cover ? (
                  <code className={s.slug}>{cover}</code>
                ) : (
                  <span className={s.dim}>미지정 — 이 화면에서는 아직 바꿀 수 없습니다</span>
                )}
              </p>

              <div className={s.colActions}>
                <AdminButton variant="primary" onClick={() => save(locale)} disabled={!dirty || busy}>
                  저장
                </AdminButton>
                <AdminButton
                  variant={isPublished ? 'quiet' : 'default'}
                  onClick={() => togglePublish(locale)}
                  disabled={!has || busy}
                  title={has ? undefined : '먼저 저장해야 게시할 수 있습니다'}
                >
                  {isPublished ? '게시 취소' : '게시'}
                </AdminButton>
              </div>

              {state.kind === 'saved' ? (
                <p className={s.saved} role="status">
                  저장했습니다.
                </p>
              ) : null}
              <WriteResultNotice message={state.kind === 'failed' ? state.message : null} />
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
