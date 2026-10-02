import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SuccessResponseDto } from './api-response.dto';

/**
 * Global Response Interceptor
 * Ensures all successful responses follow the standard format
 */
@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponseDto> {
    return next.handle().pipe(
      map((data) => {
        // If data is already a SuccessResponseDto, return as-is
        if (data instanceof SuccessResponseDto) {
          return data;
        }

        // If data has a _meta property (pagination etc), extract it
        if (data && typeof data === 'object' && '_meta' in data) {
          const { _meta, ...rest } = data;
          return new SuccessResponseDto(rest, _meta);
        }

        // Otherwise wrap in standard success response
        return new SuccessResponseDto(data);
      }),
    );
  }
}
