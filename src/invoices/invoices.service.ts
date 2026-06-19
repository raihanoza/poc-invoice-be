import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toDateOnly } from '../common/date.util';
import { ReminderDispatchService } from '../messaging/reminder-dispatch.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices.query.dto';

const invoiceInclude = {
  items: true,
  client: true,
} satisfies Prisma.InvoiceInclude;

export type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: typeof invoiceInclude;
}>;

// item rows with their totals already worked out, plus the invoice total
interface ComputedItems {
  itemsData: Prisma.InvoiceItemCreateWithoutInvoiceInput[];
  grandTotal: Prisma.Decimal;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reminderDispatch: ReminderDispatchService,
  ) {}

  async create(dto: CreateInvoiceDto): Promise<InvoiceWithRelations> {
    const createdDate = toDateOnly(dto.createdDate);
    const dueDate = toDateOnly(dto.dueDate);
    this.assertDueAfterCreated(createdDate, dueDate);

    const clientConnectOrCreate = await this.resolveClient(
      dto.clientId,
      dto.client,
    );

    const { itemsData, grandTotal } = this.computeItems(dto.items);

    const invoiceNo = dto.invoiceNo ?? (await this.generateInvoiceNo(createdDate));
    const shareToken = this.generateShareToken();

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNo,
        createdDate,
        dueDate,
        notes: dto.notes,
        grandTotal,
        shareToken,
        status: InvoiceStatus.unpaid,
        ...clientConnectOrCreate,
        items: { create: itemsData },
      },
      include: invoiceInclude,
    });

    // already due? send the reminder now instead of waiting for the nightly n8n run.
    // don't await it, otherwise the response hangs while we draft and send the message.
    if (this.reminderDispatch.shouldDispatchOnCreate(invoice)) {
      void this.reminderDispatch.dispatchForInvoice(invoice.id);
    }

    return invoice;
  }

  // manual reminder triggered from POST /invoices/:id/remind
  remind(id: string) {
    return this.reminderDispatch.remindNow(id);
  }

  async update(
    id: string,
    dto: UpdateInvoiceDto,
  ): Promise<InvoiceWithRelations> {
    const existing = await this.findOne(id);

    // check the date order against whatever values are actually changing
    const createdDate = dto.createdDate
      ? toDateOnly(dto.createdDate)
      : existing.createdDate;
    const dueDate = dto.dueDate ? toDateOnly(dto.dueDate) : existing.dueDate;
    this.assertDueAfterCreated(createdDate, dueDate);

    if (dto.clientId) {
      await this.assertClientExists(dto.clientId);
    }

    const scalarData: Prisma.InvoiceUpdateInput = {
      ...(dto.invoiceNo !== undefined ? { invoiceNo: dto.invoiceNo } : {}),
      ...(dto.createdDate !== undefined ? { createdDate } : {}),
      ...(dto.dueDate !== undefined ? { dueDate } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.clientId ? { client: { connect: { id: dto.clientId } } } : {}),
    };

    const itemsProvided = dto.items !== undefined;
    const computed = itemsProvided ? this.computeItems(dto.items!) : null;

    // when items change, swap them out and recompute the total in one transaction
    return this.prisma.$transaction(async (tx) => {
      if (itemsProvided) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      }
      return tx.invoice.update({
        where: { id },
        data: {
          ...scalarData,
          ...(computed
            ? {
                grandTotal: computed.grandTotal,
                items: { create: computed.itemsData },
              }
            : {}),
        },
        include: invoiceInclude,
      });
    });
  }

  async markAsPaid(id: string): Promise<InvoiceWithRelations> {
    await this.findOne(id);
    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.paid },
      include: invoiceInclude,
    });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.findOne(id);
    // items and reminder logs get cleaned up by the cascade in the schema
    await this.prisma.invoice.delete({ where: { id } });
    return { id };
  }

  findAll(query: ListInvoicesQueryDto): Promise<InvoiceWithRelations[]> {
    return this.prisma.invoice.findMany({
      where: query.status ? { status: query.status } : {},
      include: invoiceInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<InvoiceWithRelations> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: invoiceInclude,
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    return invoice;
  }

  async findByToken(token: string): Promise<InvoiceWithRelations> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { shareToken: token },
      include: invoiceInclude,
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  private assertDueAfterCreated(createdDate: Date, dueDate: Date): void {
    if (dueDate.getTime() < createdDate.getTime()) {
      throw new BadRequestException('dueDate must be on or after createdDate');
    }
  }

  // builds the nested prisma write to either connect an existing client or
  // create a new one inline. caller must pass exactly one of clientId / client.
  private async resolveClient(
    clientId: string | undefined,
    client: CreateInvoiceDto['client'],
  ): Promise<Pick<Prisma.InvoiceCreateInput, 'client'>> {
    if (clientId && client) {
      throw new BadRequestException(
        'Provide either clientId or an inline client, not both',
      );
    }
    if (!clientId && !client) {
      throw new BadRequestException(
        'Either clientId or an inline client is required',
      );
    }

    if (clientId) {
      await this.assertClientExists(clientId);
      return { client: { connect: { id: clientId } } };
    }

    return { client: { create: client! } };
  }

  private async assertClientExists(clientId: string): Promise<void> {
    const found = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!found) {
      throw new BadRequestException(`Client ${clientId} does not exist`);
    }
  }

  // qty * unitPrice for each line, then add them all up for the total
  private computeItems(items: CreateInvoiceDto['items']): ComputedItems {
    const itemsData = items.map((it) => {
      const qty = new Prisma.Decimal(it.qty);
      const unitPrice = new Prisma.Decimal(it.unitPrice);
      return {
        description: it.description,
        qty,
        unitPrice,
        lineTotal: qty.mul(unitPrice),
      };
    });

    const grandTotal = itemsData.reduce(
      (acc, it) => acc.add(it.lineTotal),
      new Prisma.Decimal(0),
    );

    return { itemsData, grandTotal };
  }

  // format is INV-YYYYMM-XXXX, where XXXX just counts up within the month
  private async generateInvoiceNo(forDate: Date): Promise<string> {
    const ym = `${forDate.getUTCFullYear()}${String(
      forDate.getUTCMonth() + 1,
    ).padStart(2, '0')}`;
    const prefix = `INV-${ym}-`;
    const count = await this.prisma.invoice.count({
      where: { invoiceNo: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private generateShareToken(): string {
    return randomBytes(16).toString('hex');
  }
}
