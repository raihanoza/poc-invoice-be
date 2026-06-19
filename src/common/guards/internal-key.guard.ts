import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

// bare-minimum gate on the /internal/* endpoints that n8n calls: match the
// x-internal-key header against INTERNAL_API_KEY. this isn't real auth, it just
// stops the endpoints from being trivially hit from outside.
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
