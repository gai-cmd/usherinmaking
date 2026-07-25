// 서버 계층 공통 에러 + Response 매핑.
//
// 데이터 계층이 아직 Prisma에 연결되지 않았으므로, "쓰기가 성공한 척"을 구조적으로
// 막는 것이 이 파일의 목적이다. 쓰기 함수는 NotImplementedError를 던지고
// 라우트 핸들러는 그것을 501로 정직하게 내보낸다.

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  /** alt 3개 언어 미완성 — 전시 차단. UI가 이 코드로 분기한다. */
  | 'ALT_INCOMPLETE'
  | 'NOT_IMPLEMENTED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'INTERNAL';

/** 모든 도메인 에러의 베이스. status/code를 들고 있어 라우트에서 분기가 필요 없다. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** 클라이언트에 노출해도 되는 부가 정보만 담는다. 입력 원문은 절대 넣지 않는다. */
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '관리자 인증이 필요합니다.') {
    super('UNAUTHORIZED', 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '권한이 없습니다.') {
    super('FORBIDDEN', 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = '대상을 찾을 수 없습니다.') {
    super('NOT_FOUND', 404, message);
  }
}

export class ValidationError extends AppError {
  constructor(message = '입력값이 올바르지 않습니다.', details?: Record<string, unknown>) {
    super('VALIDATION_FAILED', 422, message, details);
  }
}

/**
 * 아직 구현되지 않은 쓰기 경로. 스텁이 성공을 흉내내지 않도록 항상 이걸 던진다.
 * message에는 무엇이 연결되면 풀리는지를 적는다.
 */
export class NotImplementedError extends AppError {
  constructor(what: string) {
    super('NOT_IMPLEMENTED', 501, `${what} — 저장 경로가 아직 연결되지 않았습니다.`);
  }
}

/** 외부 의존(인스타 토큰, 오브젝트 스토리지, AI 제공자)이 없어서 진행 불가. */
export class DependencyUnavailableError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('DEPENDENCY_UNAVAILABLE', 503, message, details);
  }
}

type ErrorBody = {
  error: { code: ErrorCode; message: string; details?: Record<string, unknown> };
};

/** 임의의 throw를 안전한 JSON 응답으로. 알 수 없는 에러의 내부 메시지는 흘리지 않는다. */
export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    const body: ErrorBody = {
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    };
    return Response.json(body, { status: err.status });
  }

  // 예기치 못한 에러는 서버 로그에만 남기고 클라이언트에는 일반 메시지만 준다.
  console.error('[api] unhandled error', err);
  const body: ErrorBody = {
    error: { code: 'INTERNAL', message: '처리 중 오류가 발생했습니다.' },
  };
  return Response.json(body, { status: 500 });
}

/**
 * 쓰기 스텁의 반환 타입. 로그처럼 실패해도 흐름을 끊으면 안 되는 경로에서 쓴다.
 * 던지는 대신 "저장 안 됨"을 값으로 돌려주되, 성공을 가장하지는 않는다.
 */
export type PersistResult = { persisted: boolean; reason?: string };

export const NOT_PERSISTED: PersistResult = {
  persisted: false,
  reason: 'DB가 연결되지 않아 기록되지 않았습니다.',
};
