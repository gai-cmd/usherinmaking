'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import s from './AdminNav.module.css';

export type AdminNavItem = { href: string; label: string };

/**
 * 관리자 사이드바 항목. 화면을 새로 만드는 에이전트는 여기에 한 줄을 추가한다.
 * 순서 = 운영 동선(수집 → 선별 → 문의 → 콘텐츠 → 설정).
 */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/photos', label: '전시 선별' },
  { href: '/admin/inquiries', label: '문의' },
  // 문구 편집은 저장이 실제로 되고 공개 페이지에도 반영되는데 내비에 빠져 있어
  // 주소를 직접 쳐야만 닿을 수 있었다. 동선상 문의 다음, 후기 앞이 맞다.
  { href: '/admin/content', label: '페이지 문구' },
  { href: '/admin/journal', label: '촬영후기' },
  { href: '/admin/plans', label: '플랜 · 옵션' },
  { href: '/admin/dress', label: '드레스' },
  { href: '/admin/translations', label: '번역 JA / EN / KO' },
  { href: '/admin/taxonomy', label: '카테고리' },
  { href: '/admin/seo', label: 'SEO / AEO' },
  { href: '/admin/media', label: '미디어 · 로그' },
  { href: '/admin/services', label: '외부 서비스' },
  { href: '/admin/settings', label: '설정' },
];

function isActive(pathname: string, href: string): boolean {
  // /admin 은 정확히 일치할 때만 활성 — 그렇지 않으면 모든 하위 화면에서 켜진다.
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
}

export function AdminNav({ items = ADMIN_NAV }: { items?: AdminNavItem[] }) {
  const pathname = usePathname() ?? '';

  return (
    <nav className={s.root} aria-label="관리자 메뉴">
      <div className={s.brand}>
        <Image
          src="/brand/logo.png"
          alt="usherinmaking"
          width={195}
          height={48}
          className={s.logo}
        />
        <span className={s.kicker}>ADMIN</span>
      </div>
      <ul className={s.list}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={active ? `${s.item} ${s.active}` : s.item}
                aria-current={active ? 'page' : undefined}
                data-tap
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
