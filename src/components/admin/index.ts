// 관리자 공용 컴포넌트 키트.
// 관리자 화면은 전부 여기서 가져다 쓴다 — 화면마다 표·배지·패널을 새로 만들지 않는다.
//
// 주의: 아래 컴포넌트의 색은 src/app/admin/admin-tokens.css 의 .uim-admin 변수에 의존한다.
// 관리자 레이아웃(<body class="uim-admin">) 안에서만 정상적으로 보인다.

export { AdminNav, ADMIN_NAV, type AdminNavItem } from './AdminNav';
export { PageHeader, AdminButton, Toolbar, Panel } from './PageHeader';
export { StatTile } from './StatTile';
export { Badge, SuggestionBadge, type BadgeTone } from './Badge';
export { DataTable, type Column } from './DataTable';
export { NotWired, WriteResultNotice } from './NotWired';
export { FilterChip, type FilterChipProps } from './FilterChip';
export { formatDate, formatDateTime, formatTime, formatDimensions, formatCount } from './format';
