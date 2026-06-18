import { Controller, Get, Param } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

/**
 * Public, no-auth share endpoint (Section 5.2): GET /public/invoices/:token
 * Looked up by share_token so a client can open the invoice without logging in.
 */
@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':token')
  findByToken(@Param('token') token: string) {
    return this.invoicesService.findByToken(token);
  }
}
