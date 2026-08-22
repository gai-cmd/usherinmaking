import type { OptionRow } from './content';
import s from './PlanBody.module.css';

/**
 * 옵션 표. 플랜 페이지와 스튜디오 페이지가 같은 표를 쓴다.
 *
 * 행 구성은 페이지마다 다르다 — 스튜디오 옵션은 스튜디오 페이지가, 로케이션 옵션은
 * 플랜 페이지가 갖는다. 여기서는 무엇을 실을지 정하지 않고 받아서 그리기만 한다.
 * 스타일을 PlanBody.module.css 에서 그대로 가져오는 건 두 표가 같아 보여야 하기 때문이다.
 */
export function OptionTable({
  label,
  title,
  lead,
  head,
  rows,
  footNotes,
  alt = true,
}: {
  label: string;
  title: string;
  lead?: string;
  head: readonly string[];
  rows: OptionRow[];
  footNotes?: readonly string[];
  /** 플랜 묶음 사이에 끼울 때는 배경을 깔지 않는다 — 줄무늬처럼 보인다 */
  alt?: boolean;
}) {
  return (
    <section className={`u-section ${alt ? 'u-section--alt' : ''}`}>
      <div className="u-wrap">
        <div className={s.optHead}>
          <p className="u-label">{label}</p>
          <h2 className={`u-h2 ${s.optTitle}`}>{title}</h2>
          {lead && <p className={s.optLead}>{lead}</p>}
        </div>
        <table className={s.table}>
          <thead>
            <tr>
              {head.map((cell) => (
                <th key={cell} scope="col">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td className={`u-num ${s.optPrice}`}>{row.price}</td>
                <td className={s.optNote}>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {footNotes?.map((line) => (
          <p key={line} className={s.optNote}>
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}
