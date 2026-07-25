'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { CONTACT, SESSION_TYPES, type SessionTypeValue } from '@/app/[locale]/contact/content';
import { LOCALES, LOCALE_LABEL, path, type Locale } from '@/lib/i18n';
import s from './EnquiryForm.module.css';

type Status = 'idle' | 'sending' | 'sent' | 'invalid' | 'failed';

/** 문의 폼. 상호작용이 필요한 이 부분만 클라이언트 컴포넌트다. */
export function EnquiryForm({ locale }: { locale: Locale }) {
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
        {CONTACT.privacyNote[locale]} (
        <Link href={path(locale, 'privacy')} className="u-link">
          {CONTACT.privacyLink[locale]}
        </Link>
        ).
      </p>

      <div className={s.submitRow}>
        <button type="submit" className="u-btn-dark" disabled={status === 'sending'} data-tap>
          {status === 'sending' ? CONTACT.sending[locale] : CONTACT.submit[locale]}
        </button>
      </div>

      <p className={s.status} role="status" aria-live="polite" data-tone={status}>
        {message}
      </p>
    </form>
  );
}
