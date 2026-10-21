export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, status: number, code: string, retryable = false) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export function toErrorBody(error: unknown, requestId: string) {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          retryable: error.retryable,
        },
      },
    };
  }

  console.error(
    JSON.stringify({
      requestId,
      event: "unhandled",
      name: error instanceof Error ? error.name : "unknown",
    }),
  );

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL",
        message: "Что-то пошло не так. Попробуйте ещё раз.",
        requestId,
        retryable: true,
      },
    },
  };
}
