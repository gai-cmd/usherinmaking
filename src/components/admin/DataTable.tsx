import type { ReactNode } from 'react';
import s from './DataTable.module.css';

export type Column<T> = {
  /** React key로만 쓴다 */
  key: string;
  header: ReactNode;
  /** CSS 길이. 생략하면 auto */
  width?: string;
  align?: 'left' | 'right' | 'center';
  cell: (row: T) => ReactNode;
};

/**
 * 관리자 목록 표. 정렬·페이지네이션은 넣지 않았다 —
 * 필요한 화면이 URL 쿼리로 처리하고 서버에서 정렬해 내려주는 편이 단순하다.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  empty = '표시할 항목이 없습니다.',
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  empty?: ReactNode;
}) {
  if (rows.length === 0) {
    return <p className={s.empty}>{empty}</p>;
  }

  return (
    <div className={s.scroll}>
      <table className={s.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={{ width: c.width, textAlign: c.align ?? 'left' }}
                className={s.th}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={getRowKey(row, i)} className={s.tr}>
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align ?? 'left' }} className={s.td}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
