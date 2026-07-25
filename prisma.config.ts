import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7부터 접속 URL은 스키마가 아니라 여기에 둔다.
// 마이그레이션(DDL)은 풀러를 통과하면 안 되므로 비풀링 URL을 쓴다 —
// pgbouncer 뒤에서는 세션 상태가 유지되지 않아 DDL이 깨진다.
// 런타임 연결은 별개다: src/server/db.ts 가 풀링 URL + Neon 어댑터를 쓴다.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL_UNPOOLED'),
  },
});
