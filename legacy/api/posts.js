// Vercel Serverless Function — /api/posts  （ブログ記事 API）
// ---------------------------------------------------------------------------
//   公開（認証不要）:
//     GET /api/posts               → 公開記事の一覧（軽量サマリ・新しい順）
//     GET /api/posts?slug=X        → 公開記事 1 件（全文）
//   管理（要トークン）:
//     GET  /api/posts?all=1        → 全記事（下書き含む）サマリ
//     GET  /api/posts?id=X&all=1   → 記事 1 件（編集用・全文）
//     POST /api/posts {action:'save', post}      → 追加 / 更新（upsert）
//     POST /api/posts {action:'delete', id}      → 削除
//     POST /api/posts {action:'rss', blogId}     → Naver RSS 記事一覧を取得
//     POST /api/posts {action:'import', logNo}   → Naver 本文を取得して下書き作成
//     POST /api/posts {action:'translate', id, target} → ko→ja / ko→en 翻訳
//
// 保存は store.js（KV / 本番必須）。本文は保存時にサニタイズ（保存型 XSS 対策）。
// トークン検証は api/_lib/auth.js（ADMIN_TOKEN_SECRET / ADMIN_PASSWORD 由来）。

import store from './_lib/store.js';
import { verifyToken } from './_lib/auth.js';
import {
  POSTS_KEY, normalizePost, postSummary, sanitizeHtml,
  slugify, genId, fetchRss, fetchPostBody,
} from './_lib/blog.js';
import { translateFields } from './_lib/translate.js';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

const nowIso = () => new Date().toISOString();

async function allPosts() {
  const arr = await store.list(POSTS_KEY);
  return arr.map((p, i) => normalizePost(p, i));
}

function published(posts) {
  return posts
    .filter((p) => p.status === 'published')
    .sort((a, b) => String(b.date || b.updatedAt).localeCompare(String(a.date || a.updatedAt)));
}

// 本文 3 言語をまとめてサニタイズ。
function sanitizeBody(body) {
  return {
    ja: sanitizeHtml(body.ja),
    en: sanitizeHtml(body.en),
    ko: sanitizeHtml(body.ko),
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const q = req.query || {};
      const wantAll = q.all === '1' || q.all === 'true';
      const authed = verifyToken(req);

      // 管理用（全件・下書き含む）
      if (wantAll) {
        if (!authed) return res.status(401).json({ error: '인증이 필요합니다.' });
        const posts = await allPosts();
        if (q.id) {
          const one = posts.find((p) => p.id === q.id);
          if (!one) return res.status(404).json({ error: '記事が見つかりません。' });
          return res.status(200).json({ post: one });
        }
        const sorted = posts.sort((a, b) =>
          String(b.updatedAt || b.date).localeCompare(String(a.updatedAt || a.date)));
        return res.status(200).json({ posts: sorted.map(postSummary) });
      }

      // 公開用
      const posts = published(await allPosts());
      if (q.slug) {
        const one = posts.find((p) => p.slug === q.slug);
        if (!one) return res.status(404).json({ error: 'Not found' });
        return res.status(200).json({ post: one });
      }
      return res.status(200).json({ posts: posts.map(postSummary) });
    }

    if (req.method === 'POST') {
      if (!verifyToken(req)) {
        return res.status(401).json({ error: '인증이 필요합니다. 다시 로그인해 주세요.' });
      }
      const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
      const action = String(body.action || 'save');

      // ── Naver RSS 記事一覧 ───────────────────────────────────────────────
      if (action === 'rss') {
        try {
          const items = await fetchRss(body.blogId);
          return res.status(200).json({ items });
        } catch (e) {
          return res.status(502).json({ error: e.message || 'RSS 취득에 실패했습니다.' });
        }
      }

      // ── Naver 本文を取得して下書き作成 ──────────────────────────────────
      if (action === 'import') {
        const logNo = String(body.logNo || '').replace(/[^0-9]/g, '');
        if (!logNo) return res.status(400).json({ error: 'logNo가 필요합니다.' });
        let data;
        try {
          data = await fetchPostBody(body.blogId, logNo);
        } catch (e) {
          return res.status(502).json({ error: e.message || '本文 취득에 실패했습니다.' });
        }
        const posts = await allPosts();
        // 既に同じ logNo を取り込み済みなら二重作成しない
        if (posts.some((p) => p.source && p.source.logNo === logNo)) {
          return res.status(409).json({ error: '이미 가져온 글입니다.' });
        }
        const post = normalizePost({
          id: genId(),
          slug: slugify(data.title, logNo),
          status: 'draft',
          category: String(body.category || ''),
          cover: data.cover || '',
          date: String(body.date || ''),
          title: { ko: data.title, ja: '', en: '' },
          body: { ko: sanitizeHtml(data.body), ja: '', en: '' },
          excerpt: { ko: '', ja: '', en: '' },
          source: { logNo, url: data.url },
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
        posts.push(post);
        await store.set(POSTS_KEY, posts);
        return res.status(200).json({ ok: true, post });
      }

      // ── 翻訳（ko → ja / en）────────────────────────────────────────────
      if (action === 'translate') {
        const target = body.target === 'en' ? 'en' : 'ja';
        const posts = await allPosts();
        const idx = posts.findIndex((p) => p.id === body.id);
        if (idx === -1) return res.status(404).json({ error: '記事가 없습니다.' });
        const p = posts[idx];
        try {
          const out = await translateFields(
            { title: p.title.ko, excerpt: p.excerpt.ko, body: p.body.ko },
            target
          );
          p.title[target] = out.title;
          p.excerpt[target] = out.excerpt;
          p.body[target] = sanitizeHtml(out.body);
          p.updatedAt = nowIso();
          posts[idx] = normalizePost(p, idx);
          await store.set(POSTS_KEY, posts);
          return res.status(200).json({ ok: true, post: posts[idx] });
        } catch (e) {
          const code = e.code === 'NO_API_KEY' ? 501 : 502;
          return res.status(code).json({ error: e.message || '번역에 실패했습니다.' });
        }
      }

      // ── 削除 ─────────────────────────────────────────────────────────────
      if (action === 'delete') {
        const posts = await allPosts();
        const next = posts.filter((p) => p.id !== body.id);
        if (next.length === posts.length) return res.status(404).json({ error: '記事가 없습니다.' });
        await store.set(POSTS_KEY, next);
        return res.status(200).json({ ok: true });
      }

      // ── 追加 / 更新（upsert）──────────────────────────────────────────────
      if (action === 'save') {
        const input = body.post && typeof body.post === 'object' ? body.post : {};
        const posts = await allPosts();
        const idx = input.id ? posts.findIndex((p) => p.id === input.id) : -1;

        const draft = normalizePost(
          { ...(idx >= 0 ? posts[idx] : {}), ...input },
          idx >= 0 ? idx : posts.length
        );
        draft.body = sanitizeBody(draft.body);
        // スラッグの一意化（他記事と衝突したら連番付与）
        let slug = draft.slug, n = 2;
        while (posts.some((p, i) => i !== idx && p.slug === slug)) slug = `${draft.slug}-${n++}`;
        draft.slug = slug;
        draft.updatedAt = nowIso();
        if (idx >= 0) {
          draft.createdAt = posts[idx].createdAt || nowIso();
          posts[idx] = draft;
        } else {
          draft.createdAt = nowIso();
          posts.push(draft);
        }
        try {
          await store.set(POSTS_KEY, posts);
        } catch (e) {
          console.error('[posts] write failed', e && e.message);
          return res.status(500).json({ error: '저장에 실패했습니다. 운영 환경에서는 Vercel KV가 필요합니다.' });
        }
        return res.status(200).json({ ok: true, post: draft });
      }

      return res.status(400).json({ error: '알 수 없는 action입니다.' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (e) {
    console.error('[posts]', e && e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
