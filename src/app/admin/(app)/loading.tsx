import s from './state.module.css';

/**
 * 관리자 화면 로딩 골격.
 *
 * 공개 사이트에는 두지 않았다 — 그쪽은 118페이지가 전부 정적이라 이동이 즉시이고,
 * 골격을 끼우면 이득 없이 깜빡임만 생긴다. 관리자는 layout 이 force-dynamic 이고
 * 페이지마다 DB를 조회하므로 여기서만 기다림이 실제로 발생한다.
 *
 * 스피너 대신 골격을 쓰는 이유는 다음 화면의 자리를 미리 잡아 두어 내용이 도착할 때
 * 레이아웃이 튀지 않게 하려는 것이다.
 */
export default function AdminLoading() {
  return (
    <div className={s.root} aria-busy="true" aria-live="polite">
      <p className={s.label}>불러오는 중</p>
      <div className={s.skeleton}>
        <span className={s.bar} />
        <span className={s.bar} />
        <span className={s.bar} />
        <span className={s.bar} />
      </div>
      <span className="u-visually-hidden">내용을 불러오고 있습니다</span>
    </div>
  );
}
