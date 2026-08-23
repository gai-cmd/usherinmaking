#!/usr/bin/env bash
# usherinmaking 풀스택 오프라인 백업.
#
# 서버(Vercel)·DB(Neon)·스토리지(Blob)가 한꺼번에 사라져도 이 폴더 하나로
# 다시 세울 수 있어야 한다. 그래서 다섯 가지를 모두 받는다:
#   01-source  git 전체 이력(bundle) + 작업 트리(미커밋 포함)
#   02-db      PostgreSQL 덤프 (custom 형식 + 읽을 수 있는 SQL)
#   03-blob    사진·영상 원본 전부 + manifest
#   04-config  환경변수·Vercel 프로젝트/도메인 설정
#   05-mirror  공개 사이트 정적 미러 (Node 없이도 열어볼 수 있는 비상용)
#
# 사용: scripts/backup/backup.sh [대상 루트]   (기본 ~/personal/backups/usherinmaking)
set -euo pipefail
cd "$(dirname "$0")/../.."

ROOT="${1:-$HOME/personal/backups/usherinmaking}"
STAMP="$(date +%Y%m%d-%H%M)"
OUT="$ROOT/$STAMP"
mkdir -p "$OUT"
LOG="$OUT/backup.log"
exec > >(tee -a "$LOG") 2>&1
echo "== 백업 시작 $STAMP → $OUT"

step() { echo; echo "---- $1"; }

# 환경변수는 .env.local 에서만 읽는다. Vercel env pull 은 sensitive 값을 비워서 준다.
envval() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2- | tr -d '"'; }

# Neon 은 PostgreSQL 18 이다. pg_dump 는 서버보다 낮은 메이저면 거부하므로
# 기본 PATH 의 17 이 아니라 18 을 명시한다 (brew install postgresql@18).
PG18=/opt/homebrew/opt/postgresql@18/bin
[ -x "$PG18/pg_dump" ] || { echo "postgresql@18 이 없습니다: brew install postgresql@18"; exit 1; }
export PATH="$PG18:$PATH"

step "01 소스 코드"
mkdir -p "$OUT/01-source"
git bundle create "$OUT/01-source/repo.bundle" --all
git rev-parse HEAD > "$OUT/01-source/HEAD.txt"
git status --porcelain > "$OUT/01-source/uncommitted.txt" || true
# 작업 트리 — 미커밋 변경과 .env 까지 포함. 빌드 산출물과 의존성은 재생성 가능하니 뺀다.
tar --exclude=node_modules --exclude=.next --exclude=.git --exclude='.moai/logs' \
    -czf "$OUT/01-source/worktree.tar.gz" .
echo "bundle $(du -h "$OUT/01-source/repo.bundle" | cut -f1) · worktree $(du -h "$OUT/01-source/worktree.tar.gz" | cut -f1)"

step "02 데이터베이스 (Neon PostgreSQL)"
mkdir -p "$OUT/02-db"
DB_URL="$(envval DATABASE_URL_UNPOOLED)"
[ -n "$DB_URL" ] || { echo "DATABASE_URL_UNPOOLED 없음"; exit 1; }
pg_dump "$DB_URL" -Fc --no-owner --no-acl -f "$OUT/02-db/usherinmaking.dump"
pg_dump "$DB_URL" --no-owner --no-acl | gzip > "$OUT/02-db/usherinmaking.sql.gz"
# n_live_tup 은 통계 추정치라 실제와 어긋난다(리허설에서 117건 차이가 났다). count(*) 로 센다.
psql "$DB_URL" -At -c "select string_agg(format('select %L||'': ''||count(*) from %I', relname, relname), ' union all ' order by relname) from pg_stat_user_tables" \
  | xargs -0 psql "$DB_URL" -At -c | sort > "$OUT/02-db/row-counts.txt"
cp prisma/schema.prisma "$OUT/02-db/"
echo "dump $(du -h "$OUT/02-db/usherinmaking.dump" | cut -f1)"; cat "$OUT/02-db/row-counts.txt"

step "03 Blob 스토리지"
node scripts/backup/blob-download.mjs "$OUT/03-blob"

step "04 설정"
mkdir -p "$OUT/04-config"
cp .env.local "$OUT/04-config/env.local"
chmod 600 "$OUT/04-config/env.local"
cp vercel.json next.config.ts package.json package-lock.json "$OUT/04-config/"
vercel env ls production > "$OUT/04-config/vercel-env-list.txt" 2>&1 || true
vercel project inspect usherinmaking > "$OUT/04-config/vercel-project.txt" 2>&1 || true
vercel domains ls > "$OUT/04-config/vercel-domains.txt" 2>&1 || true
for d in usherinmaking.com usherinmaking.jp; do
  { echo "== $d"; for r in A NS MX TXT CNAME; do echo "-- $r"; dig +short "$d" $r; done; } >> "$OUT/04-config/dns-snapshot.txt"
done

step "05 공개 사이트 정적 미러"
mkdir -p "$OUT/05-mirror"
# 정본 도메인을 받는다. vercel.app 을 받으면 전부 정본으로 308 되어 wget 이 멈춘다
# (2026-08-23 백업 도중 도메인이 전환되며 실제로 겪었다).
SITE="$(envval NEXT_PUBLIC_SITE_URL)"; SITE="${SITE:-https://usherinmaking.com}"
# 같은 도메인 안의 HTML·CSS·JS 만 받는다. 이미지·영상은 03-blob 이 원본을 갖고 있다.
wget --quiet --mirror --page-requisites --adjust-extension --no-parent \
     --wait=0.2 --timeout=30 --tries=2 -e robots=off \
     --reject-regex '/admin|/api/' \
     --directory-prefix="$OUT/05-mirror" \
     "$SITE/sitemap.xml" "$SITE/" || echo "(미러 일부 실패 — 비상용이라 계속 진행)"
echo "미러 $(find "$OUT/05-mirror" -type f | wc -l | tr -d ' ') 파일"

step "무결성"
( cd "$OUT" && find . -type f ! -name SHA256SUMS -print0 | xargs -0 shasum -a 256 > SHA256SUMS )
cp scripts/backup/RESTORE.md "$OUT/"
echo
echo "== 완료 · 총 $(du -sh "$OUT" | cut -f1) · $OUT"
