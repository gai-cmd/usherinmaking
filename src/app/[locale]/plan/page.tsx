import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlanBody, planMetadata } from '@/components/plan/PlanBody';
import { LOCALES, ROUTE_SEGMENT, isLocale } from '@/lib/i18n';

/**
 * 플랜 페이지는 ja / ko 가 'plan', en 이 'plans' 세그먼트를 쓴다.
 * 한 로케일이 두 URL 로 열리면 canonical 이 갈라지므로, 자기 세그먼트가 아니면 404 로 닫는다.
 */
const OWNED = LOCALES.filter((l) => ROUTE_SEGMENT.plan[l] === 'plan');

export function generateStaticParams() {
  return OWNED.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale) || ROUTE_SEGMENT.plan[locale] !== 'plan') notFound();
  return await planMetadata(locale);
}

export default async function PlanPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || ROUTE_SEGMENT.plan[locale] !== 'plan') notFound();

  return <PlanBody locale={locale} />;
}
