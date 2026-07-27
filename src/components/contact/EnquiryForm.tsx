'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { CONTACT, SESSION_TYPES, type SessionTypeValue } from '@/app/[locale]/contact/content';
import { LOCALES, LOCALE_LABEL, path, type Locale } from '@/lib/i18n';
import s from './EnquiryForm.module.css';

type Status = 'idle' | 'sending' | 'sent' | 'invalid' | 'failed';

/** 문의 폼. 상호작용이 필요한 이 부분만 클라이언트 컴포넌트다. */
export function EnquiryForm({
  locale,
  privacyNote,
  submitLabel,
}: {
  locale: Locale;
  /** 관리자가 고칠 수 있는 문구. 없으면 코드 기본값을 쓴다. */
  privacyNote?: string;
  submitLabel?: string;
}) {
  const [sessionType, setSessionType] = useState<SessionTypeValue>(SESSION_TYPES[0].value);
  const [replyIn, setReplyIn] = useState<Locale>(locale);
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus('sending');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: String(data.get('name') ?? ''),
          email: String(data.get('email') ?? ''),
          // 봇 감지용 미끼. 사람이 채울 수 없는 자리이므로 항상 빈 문자열이어야 한다.
          refCode: String(data.get('refCode') ?? ''),
          sessionType,
          preferredDates: String(data.get('preferredDates') ?? ''),
          people: String(data.get('people') ?? ''),
          replyIn,
          message: String(data.get('message') ?? ''),
          locale,
        }),
      });

      if (response.status === 201) {
        setStatus('sent');
        form.reset();
        return;
      }
      setStatus(response.status === 400 ? 'invalid' : 'failed');
    } catch {
      setStatus('failed');
    }
  }

  const message =
    status === 'sent'
      ? CONTACT.sent[locale]
      : status === 'invalid'
        ? CONTACT.invalid[locale]
        : status === 'failed'
          ? CONTACT.failed[locale]
          : '';

  return (
    <form className={s.form} onSubmit={handleSubmit} noValidate={false}>
      {/*
        봇 감지용 미끼 필드. 화면에서 감추고 탭 이동과 스크린리더에서도 빼 두었으므로
        사람은 채울 수 없다. 값이 들어오면 폼을 자동으로 훑은 것이다.

        이름을 refCode 로 둔 것은 의도적이다. name·email·tel·organization 처럼 뜻이
        분명한 이름을 쓰면 비밀번호 관리자가 숨은 필드까지 자동 완성해 실제 고객이
        걸린다. 뜻 없는 이름이라야 자동 완성 대상에서 벗어난다.
      */}
      <div className={s.honeypot} aria-hidden="true">
        <input
          type="text"
          name="refCode"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className={s.pair}>
        <label className={s.field}>
          <span className={s.label}>{CONTACT.fields.name[locale]}</span>
          <input
            className={s.line}
            type="text"
            name="name"
            required
            maxLength={80}
            autoComplete="name"
            placeholder={CONTACT.placeholders.name[locale]}
          />
        </label>

        <label className={s.field}>
          <span className={s.label}>{CONTACT.fields.email[locale]}</span>
          <input
            className={s.line}
            type="email"
            name="email"
            required
            maxLength={200}
            autoComplete="email"
            placeholder={CONTACT.placeholders.email[locale]}
          />
        </label>
      </div>

      <fieldset className={s.fieldset}>
        <legend className={s.label}>{CONTACT.fields.sessionType[locale]}</legend>
        <div className={s.chips}>
          {SESSION_TYPES.map((type) => (
            <label key={type.value} className={s.chip} data-selected={sessionType === type.value || undefined}>
              <input
                className="u-visually-hidden"
                type="radio"
                name="sessionTypeChoice"
                value={type.value}
                checked={sessionType === type.value}
                onChange={() => setSessionType(type.value)}
              />
              {type.label[locale]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className={s.triple}>
        <label className={s.field}>
          <span className={s.label}>{CONTACT.fields.dates[locale]}</span>
          <input
            className={s.line}
            type="text"
            name="preferredDates"
            maxLength={120}
            placeholder={CONTACT.placeholders.dates[locale]}
          />
        </label>

        <label className={s.field}>
          <span className={s.label}>{CONTACT.fields.people[locale]}</span>
          <input
            className={s.line}
            type="text"
            name="people"
            maxLength={40}
            placeholder={CONTACT.placeholders.people[locale]}
          />
        </label>

        <label className={s.field}>
          <span className={s.label}>{CONTACT.fields.replyIn[locale]}</span>
          <select
            className={s.line}
            name="replyIn"
            value={replyIn}
            onChange={(event) => setReplyIn(event.target.value as Locale)}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={s.field}>
        <span className={s.label}>{CONTACT.fields.message[locale]}</span>
        <textarea
          className={s.area}
          name="message"
          rows={5}
          maxLength={4000}
          placeholder={CONTACT.placeholders.message[locale]}
        />
      </label>

      <p className={s.privacy}>
        {privacyNote ?? CONTACT.privacyNote[locale]} (
        <Link href={path(locale, 'privacy')} className="u-link">
          {CONTACT.privacyLink[locale]}
        </Link>
        ).
      </p>

      <div className={s.submitRow}>
        <button type="submit" className="u-btn-dark" disabled={status === 'sending'} data-tap>
          {status === 'sending' ? CONTACT.sending[locale] : (submitLabel ?? CONTACT.submit[locale])}
        </button>
      </div>

      <p className={s.status} role="status" aria-live="polite" data-tone={status}>
        {message}
      </p>
    </form>
  );
}
