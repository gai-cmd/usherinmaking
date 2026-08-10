'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminButton } from '@/components/admin';
import { LOCALES, LOCALE_LABEL, type Locale } from '@/lib/i18n';
import s from './settings.module.css';

/**
 * 채널 핸들·링크 편집 폼.
 *
 * 순서는 여기서 바꾸지 않는다 — 언어별 1순위는 업무 규칙이라 서버가 지키고,
 * 이 폼이 손대는 것은 핸들과 링크뿐이다. 그래서 순서 경고가 새로 생길 일도 없다.
 * 저장은 언어마다 PATCH 한 번씩이고, 네이버 블로그 URL 은 site 설정으로 따로 나간다.
 */

type Row = { id: string; handle: string | null; url: string | null; order: number };

const CHANNEL_LABEL: Record<string, string> = {
  kakao: '카카오톡',
  line: 'LINE',
  instagram: 'Instagram',
  form: '문의 폼',
};

export function ChannelLinksForm({
  initialChannels,
  initialNaverUrl,
}: {
  initialChannels: Record<Locale, Row[]>;
  initialNaverUrl: string | null;
}) {
  const router = useRouter();
  const [channels, setChannels] = useState(initialChannels);
  const [naverUrl, setNaverUrl] = useState(initialNaverUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const setField = (locale: Locale, id: string, field: 'handle' | 'url', value: string) => {
    setChannels((prev) => ({
      ...prev,
      [locale]: prev[locale].map((c) => (c.id === id ? { ...c, [field]: value || null } : c)),
    }));
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      for (const locale of LOCALES) {
        const res = await fetch('/api/admin/settings', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind: 'channels', data: { locale, channels: channels[locale] } }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.message ?? body?.message ?? `${locale.toUpperCase()} 저장 실패 (HTTP ${res.status})`);
        }
      }
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'site', data: { naverBlogUrl: naverUrl.trim() || null } }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? '네이버 블로그 URL 저장 실패');
      }
      setMessage('저장했습니다. 공개 페이지에는 다음 빌드/재검증 때 반영됩니다.');
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.channels}>
      {LOCALES.map((locale) => (
        <div key={locale} className={s.channelBox}>
          <div className={s.channelHead}>
            <b>{LOCALE_LABEL[locale]}</b>
          </div>
          <ul className={s.channelList}>
            {channels[locale].map((c, i) => (
              <li key={c.id} className={s.channelItem}>
                <span className={s.channelOrder}>{i + 1}</span>
                <span className={s.channelFormLabel}>{CHANNEL_LABEL[c.id] ?? c.id}</span>
                {c.id === 'form' ? (
                  <span className={s.dim}>내부 폼 — 링크가 필요 없습니다</span>
                ) : (
                  <span className={s.channelInputs}>
                    <input
                      className={s.input}
                      placeholder="핸들 (예: @usherinmaking)"
                      value={c.handle ?? ''}
                      onChange={(e) => setField(locale, c.id, 'handle', e.target.value)}
                    />
                    <input
                      className={s.input}
                      placeholder="https:// 링크"
                      inputMode="url"
                      value={c.url ?? ''}
                      onChange={(e) => setField(locale, c.id, 'url', e.target.value)}
                    />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className={s.channelBox}>
        <div className={s.channelHead}>
          <b>네이버 블로그</b>
          <span className={s.dim}>한국어 페이지에만 노출</span>
        </div>
        <ul className={s.channelList}>
          <li className={s.channelItem}>
            <span className={s.channelFormLabel}>블로그 URL</span>
            <span className={s.channelInputs}>
              <input
                className={s.input}
                placeholder="https://blog.naver.com/usherinmaking"
                inputMode="url"
                value={naverUrl}
                onChange={(e) => setNaverUrl(e.target.value)}
              />
            </span>
          </li>
        </ul>
      </div>

      <div className={s.formFoot}>
        <AdminButton variant="primary" onClick={save} disabled={busy}>
          {busy ? '저장 중…' : '채널 링크 저장'}
        </AdminButton>
        {message && <span className={s.formMessage}>{message}</span>}
      </div>
    </div>
  );
}
