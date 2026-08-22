import { prisma, isDatabaseConfigured } from '@/server/db';
import {
  isVaultReady,
  maskSecret,
  seal,
  unseal,
  type RevealOutcome,
  type SealedSecret,
  type VaultOutcome,
} from '@/server/service-vault';

/**
 * 이 사이트가 의존하는 외부 서비스 대장.
 *
 * "어디에 가입했고, 어느 계정이며, 무슨 용도이고, 어디서 관리하는가"를 한 곳에 모은다.
 * 사장님이 반년 뒤에 봐도 계정을 다시 찾아 헤매지 않게 하는 것이 목적이다.
 *
 * 두 종류의 정보가 섞여 있고, 사는 곳이 다르다.
 *  - 카탈로그(아래 SERVICES): 서비스가 무엇이고 어디서 관리하는지. 코드가 원본이다.
 *    배포마다 같아야 하고 관리자가 바꿀 이유가 없다.
 *  - 기록(가입 계정·메모·자격 증명): 운영 중에 바뀐다. Setting 테이블에 저장하고,
 *    자격 증명만 service-vault 로 봉인한다.
 *
 * 연결 상태는 저장된 기록이 아니라 실제 환경변수를 본다 — "관리자 화면에는 적어 뒀지만
 * 서버에는 안 들어가 있는" 상태를 찾아내는 것이 이 화면의 실질적인 쓸모이기 때문이다.
 */

export type ServiceCategory = 'infra' | 'content' | 'ai';

export type ServiceDef = {
  id: string;
  label: string;
  category: ServiceCategory;
  /** 무엇을 위해 쓰는가. 관리자 화면에 그대로 나간다. */
  purpose: string;
  /** 관리 콘솔 주소. 계정 확인·결제·키 재발급을 여기서 한다. */
  consoleUrl: string;
  /**
   * 이 서비스가 실제로 연결되었는지 판정하는 환경변수들. 하나라도 비면 미설정으로 본다.
   * 값은 절대 읽어서 내보내지 않는다 — 존재 여부만 본다.
   */
  envKeys: string[];
  /** 관리자가 값을 보관할 수 있는 자격 증명 칸. 비워 두면 메모만 남길 수 있다. */
  secretFields: { key: string; label: string }[];
};

export const SERVICES: ServiceDef[] = [
  {
    id: 'vercel',
    label: '호스팅 · 배포 (Vercel)',
    category: 'infra',
    purpose: '사이트가 실제로 돌아가는 곳. 배포와 도메인 연결, 환경변수 관리를 여기서 한다.',
    consoleUrl: 'https://vercel.com/dashboard',
    envKeys: [],
    secretFields: [],
  },
  {
    id: 'neon',
    label: '데이터베이스 (Neon · PostgreSQL)',
    category: 'infra',
    purpose: '문의·사진·후기 등 모든 데이터가 저장되는 원본. 여기가 비면 사이트 내용이 사라진다.',
    consoleUrl: 'https://console.neon.tech',
    envKeys: ['DATABASE_URL'],
    secretFields: [{ key: 'databaseUrl', label: '접속 문자열 (DATABASE_URL)' }],
  },
  {
    id: 'domain',
    label: '도메인',
    category: 'infra',
    purpose: 'usherinmaking.com · usherinmaking.jp 주소. 갱신을 놓치면 사이트 주소를 잃는다.',
    consoleUrl: 'https://vercel.com/domains',
    envKeys: [],
    secretFields: [],
  },
  {
    id: 'google-auth',
    label: '관리자 로그인 (Google)',
    category: 'infra',
    purpose: '이 관리자 화면에 들어오는 통로. 허용된 구글 계정만 열린다.',
    consoleUrl: 'https://console.cloud.google.com/apis/credentials',
    envKeys: ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET', 'ADMIN_ALLOWED_EMAILS'],
    secretFields: [{ key: 'clientSecret', label: 'OAuth 클라이언트 시크릿' }],
  },
  {
    id: 'blob',
    label: '이미지 저장소 (Vercel Blob)',
    category: 'content',
    purpose: '인스타에서 가져온 원본 사진과 변환본이 보관되는 곳.',
    consoleUrl: 'https://vercel.com/dashboard/stores',
    envKeys: ['BLOB_READ_WRITE_TOKEN'],
    secretFields: [{ key: 'token', label: '읽기·쓰기 토큰' }],
  },
  {
    id: 'instagram',
    label: '인스타그램 수집 (작품)',
    category: 'content',
    purpose: '@usherinmaking 게시물을 하루 한 번 자동으로 가져와 갤러리에 채운다.',
    consoleUrl: 'https://developers.facebook.com/apps',
    envKeys: ['IG_USER_ID', 'IG_ACCESS_TOKEN'],
    secretFields: [{ key: 'accessToken', label: '액세스 토큰' }],
  },
  {
    id: 'instagram-dress',
    label: '인스타그램 수집 (드레스)',
    category: 'content',
    purpose: '@usherindress 게시물을 가져와 드레스 컬렉션에 채운다.',
    consoleUrl: 'https://developers.facebook.com/apps',
    envKeys: ['IG_DRESS_USER_ID', 'IG_DRESS_ACCESS_TOKEN'],
    secretFields: [{ key: 'accessToken', label: '액세스 토큰' }],
  },
  {
    id: 'naver-blog',
    label: '네이버 블로그',
    category: 'content',
    purpose: '촬영 후기 원본. 한국어 페이지에서 안내한다.',
    consoleUrl: 'https://blog.naver.com/usherinmaking',
    envKeys: [],
    secretFields: [],
  },
  {
    id: 'ai',
    label: 'AI (Claude)',
    category: 'ai',
    purpose: '수집된 사진의 분류·대체텍스트 초안을 제안한다. 확정은 항상 관리자가 한다.',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    envKeys: ['AI_API_KEY'],
    secretFields: [{ key: 'apiKey', label: 'API 키' }],
  },
];

export const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  infra: '기반 (사이트가 도는 데 필요)',
  content: '콘텐츠 · 수집',
  ai: 'AI',
};

/* ------------------------------------------------------------------ */
/* 저장                                                                */
/* ------------------------------------------------------------------ */

const SERVICES_KEY = 'service-registry';

/** 서비스 하나에 대해 관리자가 적어 둔 것. 자격 증명은 봉인된 형태로만 들어간다. */
type ServiceRecord = {
  account: string | null;
  memo: string | null;
  secrets: Record<string, SealedSecret>;
};

type ServiceStore = Record<string, ServiceRecord>;

async function readStore(): Promise<ServiceStore> {
  if (!isDatabaseConfigured()) return {};
  try {
    const row = await prisma.setting.findUnique({
      where: { key: SERVICES_KEY },
      select: { value: true },
    });
    return row ? (JSON.parse(row.value) as ServiceStore) : {};
  } catch {
    // 화면이 통째로 죽는 것보다 빈 대장을 보여주는 편이 낫다.
    return {};
  }
}

async function writeStore(store: ServiceStore): Promise<void> {
  const json = JSON.stringify(store);
  await prisma.setting.upsert({
    where: { key: SERVICES_KEY },
    update: { value: json },
    create: { key: SERVICES_KEY, value: json },
  });
}

/* ------------------------------------------------------------------ */
/* 읽기                                                                */
/* ------------------------------------------------------------------ */

/** 자격 증명 한 칸의 상태. 값 자체는 여기 들어가지 않는다 — 가림 표기만 나간다. */
export type SecretView = {
  key: string;
  label: string;
  /** 저장된 값이 있는가 */
  stored: boolean;
  /** 저장돼 있으면 가림 표기(예: `re_••••••`), 없으면 null */
  masked: string | null;
  /** 마지막으로 저장한 시각 */
  updatedAt: string | null;
};

export type ServiceView = ServiceDef & {
  account: string | null;
  memo: string | null;
  /** 실제 서버 환경변수 기준 연결 상태 */
  connected: boolean;
  /** 비어 있는 환경변수 이름들. 무엇을 채워야 하는지 화면이 그대로 보여준다. */
  missingEnvKeys: string[];
  secrets: SecretView[];
};

export async function listServices(): Promise<ServiceView[]> {
  const store = await readStore();

  return SERVICES.map((def) => {
    const rec = store[def.id];
    const missingEnvKeys = def.envKeys.filter((k) => {
      const v = process.env[k];
      return !v || v.trim().length === 0;
    });

    const secrets: SecretView[] = def.secretFields.map((f) => {
      const sealed = rec?.secrets?.[f.key];
      if (!sealed) return { key: f.key, label: f.label, stored: false, masked: null, updatedAt: null };

      // 가림 표기를 만들려면 한 번 열어야 한다. 열린 값은 이 함수 밖으로 나가지 않는다.
      const plain = unseal(sealed);
      return {
        key: f.key,
        label: f.label,
        stored: true,
        masked: plain ? maskSecret(plain) : '(키가 달라 열 수 없음)',
        updatedAt: sealed.updatedAt ?? null,
      };
    });

    return {
      ...def,
      account: rec?.account ?? null,
      memo: rec?.memo ?? null,
      // 확인할 환경변수가 없는 서비스(도메인 등)는 연결 여부를 코드가 알 수 없다.
      // 그런 항목까지 "미설정"으로 칠하면 경고가 무뎌지므로 연결된 것으로 둔다.
      connected: missingEnvKeys.length === 0,
      missingEnvKeys,
      secrets,
    };
  });
}

export function vaultReady(): boolean {
  return isVaultReady();
}

/**
 * 자격 증명 원문 조회. 화면에서 "보기"를 눌렀을 때만, 한 건씩 호출한다.
 * 목록 응답에는 절대 섞지 않는다 — 목록은 캐시되거나 로그에 남을 수 있다.
 */
export async function revealSecret(serviceId: string, field: string): Promise<RevealOutcome> {
  if (!isVaultReady()) return { ok: false, reason: 'no_key' };

  const store = await readStore();
  const sealed = store[serviceId]?.secrets?.[field];
  if (!sealed) return { ok: false, reason: 'not_found' };

  const plain = unseal(sealed);
  if (plain === null) return { ok: false, reason: 'decrypt_failed' };

  return { ok: true, value: plain };
}

/* ------------------------------------------------------------------ */
/* 쓰기                                                                */
/* ------------------------------------------------------------------ */

export type ServiceUpdate = {
  serviceId: string;
  account?: string | null;
  memo?: string | null;
  /** 값이 있으면 봉인해 저장, 빈 문자열이면 삭제, undefined 면 건드리지 않는다. */
  secrets?: Record<string, string>;
};

export async function updateService(input: ServiceUpdate): Promise<VaultOutcome> {
  const def = SERVICES.find((s) => s.id === input.serviceId);
  if (!def) return { ok: false, reason: 'store_failed' };

  const hasSecretWrite = input.secrets && Object.keys(input.secrets).length > 0;
  // 키가 없는데 자격 증명을 저장하면 평문으로 남는다. 그럴 바에는 거부한다.
  if (hasSecretWrite && !isVaultReady()) return { ok: false, reason: 'no_key' };

  try {
    const store = await readStore();
    const current: ServiceRecord = store[input.serviceId] ?? {
      account: null,
      memo: null,
      secrets: {},
    };

    const next: ServiceRecord = {
      account: input.account !== undefined ? (input.account?.trim() || null) : current.account,
      memo: input.memo !== undefined ? (input.memo?.trim() || null) : current.memo,
      secrets: { ...current.secrets },
    };

    for (const [field, value] of Object.entries(input.secrets ?? {})) {
      // 정의에 없는 칸은 저장하지 않는다 — 카탈로그가 스키마 역할을 한다.
      if (!def.secretFields.some((f) => f.key === field)) continue;

      if (value.trim() === '') {
        delete next.secrets[field];
        continue;
      }
      const sealed = seal(value.trim());
      if (!sealed) return { ok: false, reason: 'no_key' };
      next.secrets[field] = sealed;
    }

    store[input.serviceId] = next;
    await writeStore(store);
    return { ok: true };
  } catch (err) {
    console.error(`[services] 저장 실패 (${input.serviceId})`, err);
    return { ok: false, reason: 'store_failed' };
  }
}
