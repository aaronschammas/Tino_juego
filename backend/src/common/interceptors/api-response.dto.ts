export interface ApiMeta {
  total?: number;
  page?: number;
  limit?: number;
  timestamp?: string;
}

export class SuccessResponseDto<T = any> {
  data: T;
  meta?: ApiMeta;

  constructor(data: T, meta?: ApiMeta) {
    this.data = data;
    this.meta = meta;
  }
}

export class ErrorResponseDto {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp?: string;

  constructor(code: string, message: string, details?: Record<string, any>) {
    this.code = code;
    this.message = message;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}
