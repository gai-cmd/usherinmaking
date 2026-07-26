import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlanBody, planMetadata } from '@/components/plan/PlanBody';
import { LOCALES, ROUTE_SEGMENT, isLocale } from '@/lib/i18n';

/** /en/plans 만 이 라우트를 갖는다. ja / ko 는 /plan 쪽이 canonical 이라 여기서는 404. */
const OWNED = LOCALES.filter((l) => ROUTE_SEGMENT.plan[l] === 'plans');

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
  if (!isLocale(locale) || ROUTE_SEGMENT.plan[locale] !== 'plans') notFound();
  return await planMetadata(locale);
}

export default async function PlansPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || ROUTE_SEGMENT.plan[locale] !== 'plans') notFound();

  return <PlanBody locale={locale} />;
}
