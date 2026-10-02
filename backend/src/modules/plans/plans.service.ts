import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlans() {
    return this.prisma.plan.findMany({
      orderBy: { price: 'asc' },
    });
  }

  async getPlanByName(name: string) {
    return this.prisma.plan.findUnique({
      where: { name },
    });
  }

  async getPlanById(id: string) {
    return this.prisma.plan.findUnique({
      where: { id },
    });
  }
}
