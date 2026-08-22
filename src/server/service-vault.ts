import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * 외부 서비스 자격 증명 금고.
 *
 * 관리자 화면에서 API 키·비밀번호를 보관하고 다시 볼 수 있어야 한다는 운영 요구가 있다.
 * 다만 그 값을 DB 에 평문으로 두면 DB 유출이 곧 전 서비스 장악이 되므로, 여기서
 * AES-256-GCM 으로 봉인한 뒤 Setting 테이블에 넣는다. 복호화 키(SERVICE_VAULT_KEY)는
 * DB 밖(환경변수)에 있으므로 DB 덤프만으로는 값을 읽을 수 없다.
 *
 * 두 가지는 의도적으로 하지 않는다.
 *  1) 키가 없을 때 평문으로 저장하는 폴백 — 저장된 줄 알았는데 평문인 상태가 더 위험하다.
 *     키가 없으면 저장 자체를 거부하고 그 사실을 호출부에 값으로 알린다.
 *  2) 복호화한 값을 목록 응답에 싣는 것 — 값은 revealSecret() 단건 호출로만 나간다.
 */

/** 봉인된 한 건. iv·tag 는 복호화에 필요한 부수 정보이며 비밀이 아니다. */
type SealedSecret = {
  iv: string;
  tag: string;
  data: string;
  updatedAt: string;
};

export type VaultOutcome =
  | { ok: true }
  | { ok: false; reason: 'no_key' | 'store_failed' };

export type RevealOutcome =
  | { ok: true; value: string }
  | { ok: false; reason: 'no_key' | 'not_found' | 'decrypt_failed' };

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;

/**
 * 복호화 키. `openssl rand -base64 32` 로 만든 32바이트 base64 문자열이다.
 * 길이가 어긋나면 조용히 짧은 키를 쓰지 않고 null 을 돌려준다 — 약한 키로 봉인하면
 * 봉인된 줄 알면서 실제로는 보호되지 않는다.
 */
function vaultKey(): Buffer | null {
  const raw = process.env.SERVICE_VAULT_KEY;
  if (!raw || raw.trim().length === 0) return null;

  const key = Buffer.from(raw.trim(), 'base64');
  if (key.length !== KEY_BYTES) {
    console.error(
      `[vault] SERVICE_VAULT_KEY 길이가 ${key.length}바이트입니다 — base64 로 인코딩한 32바이트여야 합니다.`,
    );
    return null;
  }
  return key;
}

/** 금고를 쓸 수 있는 상태인가. 화면이 "키 미설정" 안내를 띄우는 데 쓴다. */
export function isVaultReady(): boolean {
  return vaultKey() !== null;
}

export function seal(plaintext: string): SealedSecret | null {
  const key = vaultKey();
  if (!key) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
    updatedAt: new Date().toISOString(),
  };
}

export function unseal(sealed: SealedSecret): string | null {
  const key = vaultKey();
  if (!key) return null;

  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(sealed.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
    const out = Buffer.concat([
      decipher.update(Buffer.from(sealed.data, 'base64')),
      decipher.final(),
    ]);
    return out.toString('utf8');
  } catch {
    // 키가 바뀌었거나 값이 손상됐다. 어느 쪽이든 값을 지어내지 않는다.
    return null;
  }
}

/**
 * 화면에 보여줄 가림 표기. 앞 3자와 길이만 남긴다 —
 * "저장되어 있다"는 사실과 "어느 키인지" 정도만 구별되면 된다.
 */
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 4) return '•'.repeat(plaintext.length);
  return `${plaintext.slice(0, 3)}${'•'.repeat(Math.min(12, plaintext.length - 3))}`;
}

export type { SealedSecret };
