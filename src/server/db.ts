import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

/**
 * Prisma 클라이언트 — Neon 서버리스 어댑터.
 *
 * 서버리스에서는 요청마다 인스턴스가 늘어나므로 TCP 커넥션을 그대로 쓰면 금방 고갈된다.
 * Neon 어댑터는 HTTP/WebSocket으로 붙어 그 문제를 피한다. 연결 문자열도 풀링(pgbouncer)
 * 쪽을 쓴다 — 마이그레이션만 비풀링(prisma.config.ts)이다.
 *
 * 개발 중 핫리로드가 인스턴스를 계속 새로 만들지 않도록 globalThis에 한 번만 붙인다.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // 조용히 통과시키면 저장 실패가 런타임 깊은 곳에서야 드러난다. 여기서 끊는다.
    throw new Error('DATABASE_URL이 설정되지 않았습니다.');
  }
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? create();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/** DB가 붙어 있는지. 화면이 "연결 안 됨"을 정직하게 표시하는 데 쓴다. */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
