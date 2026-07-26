import { Fragment } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { path, type Locale } from '@/lib/i18n';
import { HERO_IMAGE, HOME } from '@/app/[locale]/home-content';
import { pickImage, type PageImageMap } from '@/lib/image-slot';
import type { PageCopy } from '@/server/page-content';
import { toLines } from '@/server/page-content';
import s from './HeroGate.module.css';

/**
 * 홈 최상단의 갈림길. LOCATION(야외)과 STUDIO(실내)는 완전히 대등한 두 축이라
 * 좌우 같은 폭·같은 높이로 놓고, 패널 전체를 하나의 링크로 만든다.
 * 모바일에서는 250px 두 장으로 쌓아 한 화면에 두 축이 모두 보이게 한다.
 */
export function HeroGate({
  locale,
  images,
  text,
}: {
  locale: Locale;
  images?: PageImageMap;
  text?: PageCopy;
}) {
  const { location, studio } = HOME[locale].hero;

  // 관리자가 고친 값이 있으면 그것을, 없으면 코드 기본값을 쓴다.
  const locationLines = text ? toLines(text['hero.location.lines']) : location.lines;
  const studioLines = text ? toLines(text['hero.studio.lines']) : studio.lines;
  const locationCta = text?.['hero.location.cta'] ?? location.cta;
  const studioCta = text?.['hero.studio.cta'] ?? studio.cta;

  // 두 패널은 사이트의 첫 화면이라 비는 상태를 허용하지 않는다.
  // 관리자가 아무것도 걸지 않았으면 지금 쓰던 경로가 그대로 나간다.
  const locationImage = pickImage(images, 'hero.location', locale, HERO_IMAGE.location, location.alt)!;
  const studioImage = pickImage(images, 'hero.studio', locale, HERO_IMAGE.studio, studio.alt)!;

  return (
    <div className={s.root}>
      <Link href={path(locale, 'location')} className={s.panel}>
        <Image
          src={locationImage.src}
          alt={locationImage.alt}
          fill
          priority
          sizes="(max-width: 767px) 100vw, 50vw"
          className={s.image}
        />
        <span className={s.scrim} />
        <span className={s.body}>
          <span className={s.eyebrow}>{location.eyebrow}</span>
          <span className={s.display}>{location.display}</span>
          <span className={s.lines}>
            {locationLines.map((line, i) => (
              <Fragment key={line}>
                {i > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </span>
          <span className={s.cta}>{locationCta}</span>
        </span>
      </Link>

      <Link href={path(locale, 'studio')} className={s.panel}>
        <Image
          src={studioImage.src}
          alt={studioImage.alt}
          fill
          priority
          sizes="(max-width: 767px) 100vw, 50vw"
          className={s.image}
        />
        <span className={s.scrim} />
        <span className={s.body}>
          <span className={s.eyebrow}>{studio.eyebrow}</span>
          <span className={s.display}>{studio.display}</span>
          <span className={s.lines}>
            {studioLines.map((line, i) => (
              <Fragment key={line}>
                {i > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </span>
          <span className={s.cta}>{studioCta}</span>
        </span>
      </Link>
    </div>
  );
}
