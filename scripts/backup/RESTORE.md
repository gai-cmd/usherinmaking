# usherinmaking 백업 복원 절차

이 폴더 하나로 서버·DB·스토리지를 전부 다시 세운다. 순서대로 진행한다.

## 구성

| 폴더 | 내용 | 복원에 쓰는 도구 |
|---|---|---|
| `01-source/` | `repo.bundle`(git 전체 이력), `worktree.tar.gz`(미커밋 포함 작업 트리) | git, tar |
| `02-db/` | `usherinmaking.dump`(pg custom), `usherinmaking.sql.gz`(plain), `schema.prisma`, `row-counts.txt` | pg_restore / psql |
| `03-blob/` | `files/`(경로 보존한 원본 12,000여 개), `manifest.json` | @vercel/blob put |
| `04-config/` | `env.local`(**비밀값 — 권한 600**), Vercel 프로젝트·도메인·DNS 스냅샷 | — |
| `05-mirror/` | 공개 사이트 정적 HTML (비상 열람용, 이미지는 03-blob 참조) | 브라우저 |
| `SHA256SUMS` | 전 파일 해시 | `shasum -a 256 -c SHA256SUMS` |

## 0. 무결성 확인

    cd <백업 폴더> && shasum -a 256 -c SHA256SUMS | grep -v ': OK$' || echo "전부 OK"

## 1. 소스 복원

    git clone 01-source/repo.bundle usherinmaking
    cd usherinmaking && git checkout feat/renewal-nextjs
    # 미커밋 변경·.env 까지 살리려면 작업 트리를 덮어쓴다
    tar -xzf ../01-source/worktree.tar.gz
    npm ci

## 2. DB 복원

새 Neon(또는 아무 PostgreSQL 16+) 프로젝트를 만들고 연결 문자열을 받는다.

    pg_restore --no-owner --no-acl -d "<새 DATABASE_URL_UNPOOLED>" 02-db/usherinmaking.dump
    psql "<새 DATABASE_URL_UNPOOLED>" -At -c "select relname||': '||n_live_tup from pg_stat_user_tables order by 1"
    diff - 02-db/row-counts.txt   # 행 수가 같아야 한다

pg_restore 가 안 되면 plain SQL 로: `gunzip -c 02-db/usherinmaking.sql.gz | psql "<URL>"`

## 3. Blob 복원

새 Vercel Blob 스토어를 만들고 RW 토큰을 받는다. 경로(pathname)를 **그대로** 올려야
DB 의 주소가 맞는다. 새 스토어는 호스트명이 달라지므로, 올린 뒤 DB 의 blob URL 호스트를
일괄 치환한다 (`MediaAsset`·`Photo` 의 url 열 — `schema.prisma` 로 열 이름 확인).

    # 올리기 (프로젝트 루트에서, BLOB_READ_WRITE_TOKEN 을 새 토큰으로)
    node -e '
    const {put}=require("@vercel/blob");const fs=require("fs");const p=require("path");
    const m=JSON.parse(fs.readFileSync("03-blob/manifest.json"));
    (async()=>{for(const b of m){await put(b.pathname,fs.readFileSync(p.join("03-blob/files",b.pathname)),{access:"public",addRandomSuffix:false,contentType:b.contentType});}})();'

    # 호스트 치환 (예)
    psql "<URL>" -c "update \"MediaAsset\" set url = replace(url, '<옛 host>', '<새 host>')"

## 4. 환경변수·배포

`04-config/env.local` 의 값을 새 Vercel 프로젝트에 넣는다. DB·Blob 은 2·3 에서 새로 만든
값으로 바꾼다. 나머지(AUTH_*, IG_*, CRON_SECRET, ADMIN_*)는 그대로.

    vercel link && vercel env add <KEY> production   # 키마다
    vercel --prod

도메인은 `04-config/vercel-domains.txt`·`dns-snapshot.txt` 대로 다시 붙인다.

## 5. 확인

- `/sitemap.xml` 의 URL 개수가 백업 시점과 비슷한지
- 갤러리 상세 몇 개를 열어 이미지가 뜨는지 (blob 호스트 치환이 됐는지)
- 관리자 로그인
