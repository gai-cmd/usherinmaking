'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminButton, Badge } from '@/components/admin';
import type { ServiceView } from '@/server/services';
import s from './services.module.css';

/**
 * 서비스 한 건의 카드.
 *
 * 자격 증명은 기본적으로 가림 표기만 보여주고, "보기"를 눌렀을 때만 서버에 단건으로 물어본다.
 * 열린 값은 이 컴포넌트의 state 에만 있고 다시 감출 수 있다 — 화면을 켜 두는 것만으로
 * 키가 계속 노출되어 있지는 않게 한다.
 */
export function ServiceCard({
  service,
  vaultReady,
}: {
  service: ServiceView;
  vaultReady: boolean;
}) {
  const router = useRouter();
  const [account, setAccount] = useState(service.account ?? '');
  const [memo, setMemo] = useState(service.memo ?? '');
  /** 새로 입력한 자격 증명. 빈 문자열이면 서버가 "건드리지 않음"으로 본다. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /** 서버에서 받아 온 원문. 키가 있는 칸만 펼쳐져 있다는 뜻이다. */
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reveal = async (field: string) => {
    setMessage(null);
    try {
      const res = await fetch('/api/admin/services', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'reveal', serviceId: service.id, field }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? body?.message ?? '값을 열 수 없습니다.');
      setRevealed((prev) => ({ ...prev, [field]: body.value }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '값을 열 수 없습니다.');
    }
  };

  const hide = (field: string) => {
    setRevealed((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      // 값을 입력한 칸만 보낸다 — 빈 칸까지 보내면 기존 값이 지워진다.
      const secrets = Object.fromEntries(Object.entries(drafts).filter(([, v]) => v !== ''));

      const res = await fetch('/api/admin/services', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          account: account.trim() || null,
          memo: memo.trim() || null,
          ...(Object.keys(secrets).length > 0 ? { secrets } : {}),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? body?.message ?? '저장에 실패했습니다.');

      setDrafts({});
      setRevealed({});
      setMessage('저장했습니다.');
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <div>
          <h3 className={s.cardTitle}>{service.label}</h3>
          <p className={s.purpose}>{service.purpose}</p>
        </div>
        {service.envKeys.length === 0 ? (
          <Badge tone="muted" title="서버 값으로 확인할 수 있는 항목이 아닙니다">
            확인 대상 아님
          </Badge>
        ) : service.connected ? (
          <Badge tone="default">연결됨</Badge>
        ) : (
          <Badge tone="warn">미설정</Badge>
        )}
      </div>

      <dl className={s.meta}>
        <div className={s.metaRow}>
          <dt>관리 페이지</dt>
          <dd>
            <a href={service.consoleUrl} target="_blank" rel="noreferrer" className={s.link}>
              {service.consoleUrl} ↗
            </a>
          </dd>
        </div>
        {service.envKeys.length > 0 && (
          <div className={s.metaRow}>
            <dt>서버 환경변수</dt>
            <dd>
              {service.envKeys.map((k) => (
                <code
                  key={k}
                  className={service.missingEnvKeys.includes(k) ? s.codeMissing : s.code}
                  title={service.missingEnvKeys.includes(k) ? '서버에 값이 없습니다' : '서버에 들어가 있습니다'}
                >
                  {k}
                </code>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <label className={s.field}>
        <span className={s.fieldLabel}>가입 계정</span>
        <input
          className={s.input}
          placeholder="예: amipaek@gmail.com (구글 로그인)"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        />
      </label>

      <label className={s.field}>
        <span className={s.fieldLabel}>메모</span>
        <textarea
          className={s.textarea}
          rows={2}
          placeholder="요금제, 갱신일, 주의할 점 등"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </label>

      {service.secretFields.length > 0 && (
        <div className={s.secrets}>
          <div className={s.secretsHead}>
            자격 증명
            <span className={s.dim}>
              {vaultReady ? '암호화해서 보관합니다' : '금고 키가 없어 저장할 수 없습니다'}
            </span>
          </div>

          {service.secrets.map((sec) => {
            const open = revealed[sec.key] !== undefined;
            return (
              <div key={sec.key} className={s.secretRow}>
                <span className={s.secretLabel}>{sec.label}</span>

                <div className={s.secretBody}>
                  {sec.stored && (
                    <div className={s.secretCurrent}>
                      <code className={s.secretValue}>{open ? revealed[sec.key] : sec.masked}</code>
                      <button
                        type="button"
                        className={s.reveal}
                        onClick={() => (open ? hide(sec.key) : reveal(sec.key))}
                        data-tap
                      >
                        {open ? '감추기' : '보기'}
                      </button>
                    </div>
                  )}

                  <input
                    className={s.input}
                    type="password"
                    autoComplete="off"
                    placeholder={sec.stored ? '새 값으로 바꾸려면 입력' : '값을 붙여넣기'}
                    value={drafts[sec.key] ?? ''}
                    onChange={(e) => setDrafts((p) => ({ ...p, [sec.key]: e.target.value }))}
                    disabled={!vaultReady}
                  />

                  {sec.updatedAt && (
                    <span className={s.dim}>
                      마지막 저장 {new Date(sec.updatedAt).toLocaleDateString('ko-KR')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className={s.cardFoot}>
        <AdminButton variant="primary" onClick={save} disabled={busy}>
          {busy ? '저장 중…' : '저장'}
        </AdminButton>
        {message && <span className={s.formMessage}>{message}</span>}
      </div>
    </div>
  );
}
