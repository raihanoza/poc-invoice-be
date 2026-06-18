import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { MessagingService } from '../messaging/messaging.service';
import { PdfService } from '../pdf/pdf.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices.query.dto';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly pdfService: PdfService,
    private readonly messagingService: MessagingService,
  ) {}

  @Post()
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListInvoicesQueryDto) {
    return this.invoicesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.invoicesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(id, dto);
  }

  @Patch(':id/mark-as-paid')
  markAsPaid(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.invoicesService.markAsPaid(id);
  }

  @Post(':id/send')
  async send(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SendInvoiceDto,
  ) {
    const invoice = await this.invoicesService.findOne(id);
    const pdf = await this.pdfService.generateInvoicePdf(invoice);
    const results = await this.messagingService.sendInvoice(
      invoice,
      pdf,
      dto.channel,
    );

    // If every attempted channel failed, surface it as an error.
    if (results.length > 0 && results.every((r) => r.status === 'failed')) {
      const detail = results
        .map((r) => `${r.channel}: ${r.detail ?? 'failed'}`)
        .join('; ');
      throw new ServiceUnavailableException(
        `Failed to send invoice on all channels (${detail})`,
      );
    }

    return { invoiceId: id, results };
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.invoicesService.remove(id);
  }

  @Get(':id/pdf')
  async pdf(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const invoice = await this.invoicesService.findOne(id);
    const buffer = await this.pdfService.generateInvoicePdf(invoice);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoiceNo}.pdf"`,
    });
    // ResponseInterceptor detects StreamableFile and skips the JSON envelope.
    return new StreamableFile(buffer);
  }
}
