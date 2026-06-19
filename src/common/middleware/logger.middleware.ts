import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Access log: prints one line per request once the response is finished, e.g.
 *   [HTTP] GET /invoices 200 12ms - 482b
 * Colour/level follows the status: 2xx/3xx = log, 4xx = warn, 5xx = error.
 * Error details (message/stack) are printed by HttpExceptionFilter.
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const start = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const ms = Date.now() - start;
      const length = res.get('content-length') ?? '0';
      const line = `${method} ${originalUrl} ${statusCode} ${ms}ms - ${length}b`;

      if (statusCode >= 500) {
        this.logger.error(line);
      } else if (statusCode >= 400) {
        this.logger.warn(line);
      } else {
        this.logger.log(line);
      }
    });

    next();
  }
}
