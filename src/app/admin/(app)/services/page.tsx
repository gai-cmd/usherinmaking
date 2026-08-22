import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/admin';
import { checkAdminPageAccess } from '@/server/auth';
import { CATEGORY_LABEL, listServices, vaultReady, type ServiceCategory } from '@/server/services';
import { ServiceCard } from './ServiceCard';
import s from './services.module.css';

export const metadata = { title: '외부 서비스 · 관리자' };

/** 자격 증명을 다루므로 어떤 경우에도 캐시하지 않는다. */
export const dynamic = 'force-dynamic';

const ORDER: ServiceCategory[] = ['infra', 'content', 'ai'];

export default async function AdminServicesPage() {
  // 레이아웃 가드만으로는 이 컴포넌트의 실행을 막지 못한다(settings 화면과 같은 이유).
  const access = await checkAdminPageAccess();
  if (!access.allowed) notFound();

  const services = await listServices();
  const ready = vaultReady();
  const disconnected = services.filter((x) => !x.connected);

  return (
    <>
      <PageHeader
        title="외부 서비스"
        description="이 사이트가 의존하는 바깥 서비스들입니다. 어느 계정으로 가입했고 어디서 관리하는지 여기에 모읍니다. 연결 상태는 적어 둔 내용이 아니라 서버에 실제로 들어가 있는 값을 기준으로 표시합니다."
        actions={null}
      />

      <div className={s.body}>
        {!ready && (
          <div className={s.vaultWarn}>
            <b>금고 키가 설정되지 않았습니다 — 자격 증명을 저장할 수 없습니다.</b>
            <p className={s.vaultWarnBody}>
              API 키·비밀번호는 암호화해서 보관합니다. 그 암호를 푸는 열쇠가 서버 환경변수{' '}
              <code className={s.code}>SERVICE_VAULT_KEY</code> 에 있어야 합니다. 키가 없으면 평문으로
              남기지 않기 위해 저장 자체를 거부합니다. 가입 계정과 메모는 지금도 저장됩니다.
            </p>
            <p className={s.vaultWarnBody}>
              키 만드는 법: 터미널에서 <code className={s.code}>openssl rand -base64 32</code> 를
              실행해 나온 값을 Vercel 환경변수에 <code className={s.code}>SERVICE_VAULT_KEY</code> 로
              등록합니다.
            </p>
          </div>
        )}

        {disconnected.length > 0 && (
          <div className={s.summary}>
            <b>서버에 값이 들어가 있지 않은 서비스 {disconnected.length}건</b>
            <ul className={s.summaryList}>
              {disconnected.map((x) => (
                <li key={x.id}>
                  {x.label} — <span className={s.dim}>{x.missingEnvKeys.join(', ')}</span>
                </li>
              ))}
            </ul>
            <p className={s.summaryNote}>
              이 항목들은 기능이 실제로 동작하지 않습니다. 값을 Vercel 환경변수에 넣어야 켜집니다.
            </p>
          </div>
        )}

        {ORDER.map((category) => {
          const group = services.filter((x) => x.category === category);
          if (group.length === 0) return null;

          return (
            <section key={category} className={s.group}>
              <h2 className={s.groupTitle}>{CATEGORY_LABEL[category]}</h2>
              <div className={s.cards}>
                {group.map((service) => (
                  <ServiceCard key={service.id} service={service} vaultReady={ready} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
