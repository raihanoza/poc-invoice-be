import { Controller, Get, Param } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

// public share link, no auth: GET /public/invoices/:token
// we find the invoice by its share_token so the client can open it without an account
@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':token')
  findByToken(@Param('token') token: string) {
    return this.invoicesService.findByToken(token);
  }
}
