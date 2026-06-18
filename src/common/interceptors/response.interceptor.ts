import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

/**
 * Wraps every successful JSON response as { success: true, data }.
 * Binary/stream responses (StreamableFile, e.g. the PDF endpoint) pass through
 * untouched so the raw stream reaches the client.
 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, SuccessEnvelope<T> | T>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessEnvelope<T> | T> {
    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) {
          return data;
        }
        return { success: true, data };
      }),
    );
  }
}
