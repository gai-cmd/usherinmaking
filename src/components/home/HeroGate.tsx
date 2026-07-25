import Image from 'next/image';
import Link from 'next/link';
import { path, type Locale } from '@/lib/i18n';
import { HERO_IMAGE, HOME } from '@/app/[locale]/home-content';
import s from './HeroGate.module.css';

/**
 * 홈 최상단의 갈림길. LOCATION(야외)과 STUDIO(실내)는 완전히 대등한 두 축이라
 * 좌우 같은 폭·같은 높이로 놓고, 패널 전체를 하나의 링크로 만든다.
 * 모바일에서는 250px 두 장으로 쌓아 한 화면에 두 축이 모두 보이게 한다.
 */
export function HeroGate({ locale }: { locale: Locale }) {
  const { location, studio } = HOME[locale].hero;

  return (
    <div className={s.root}>
      <Link href={path(locale, 'location')} className={s.panel}>
        <Image
          src={HERO_IMAGE.location}
          alt={location.alt}
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
            {location.lines[0]}
            <br />
            {location.lines[1]}
          </span>
          <span className={s.cta}>{location.cta}</span>
        </span>
      </Link>

      <Link href={path(locale, 'studio')} className={s.panel}>
        <Image
          src={HERO_IMAGE.studio}
          alt={studio.alt}
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
            {studio.lines[0]}
            <br />
            {studio.lines[1]}
          </span>
          <span className={s.cta}>{studio.cta}</span>
        </span>
      </Link>
    </div>
  );
}
