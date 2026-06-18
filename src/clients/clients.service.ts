import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Client } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateClientDto): Promise<Client> {
    return this.prisma.client.create({ data: dto });
  }

  findAll(): Promise<Client[]> {
    return this.prisma.client.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string): Promise<Client> {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }
    return client;
  }

  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    // Ensure it exists first so we return a clean 404 instead of a Prisma P2025.
    await this.findOne(id);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.findOne(id);

    const invoiceCount = await this.prisma.invoice.count({
      where: { clientId: id },
    });
    if (invoiceCount > 0) {
      throw new ConflictException(
        `Cannot delete client with ${invoiceCount} existing invoice(s)`,
      );
    }

    await this.prisma.client.delete({ where: { id } });
    return { id };
  }
}
