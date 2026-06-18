import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Minimal protection for the /internal/* endpoints (called by n8n): compares the
 * `x-internal-key` header to the INTERNAL_API_KEY env var. NOT production-grade
 * auth — just keeps these endpoints from being trivially hit from the public.
 */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header('x-internal-key');
    const expected = this.config.get<string>('INTERNAL_API_KEY');

    if (!expected) {
      throw new UnauthorizedException('Internal API key is not configured');
    }
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid or missing x-internal-key header');
    }
    return true;
  }
}
