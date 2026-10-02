/**
 * Standard API Response Types
 * Ensures all API endpoints return consistent, predictable responses
 */

export class ApiResponse<T = any> {
  constructor(
    public data?: T,
    public meta?: Record<string, any>,
    public error?: ApiError,
  ) {}
}

export class ApiError {
  constructor(
    public code: string,
    public message: string,
    public details?: Record<string, any>,
    public statusCode?: number,
  ) {}
}

export class PaginationMeta {
  constructor(
    public page: number,
    public pageSize: number,
    public total: number,
    public totalPages: number,
  ) {}
}

/**
 * Success Response DTO
 */
export class SuccessResponseDto<T = any> {
  data: T;
  meta?: Record<string, any>;

  constructor(data: T, meta?: Record<string, any>) {
    this.data = data;
    this.meta = meta;
  }
}

/**
 * Error Response DTO
 */
export class ErrorResponseDto {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };

  constructor(
    code: string,
    message: string,
    details?: Record<string, any>,
  ) {
    this.error = { code, message };
    if (details) {
      this.error.details = details;
    }
  }
}

/**
 * Paginated Response DTO
 */
export class PaginatedResponseDto<T = any> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };

  constructor(
    data: T[],
    page: number,
    pageSize: number,
    total: number,
  ) {
    this.data = data;
    this.meta = {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
