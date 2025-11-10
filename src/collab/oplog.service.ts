import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class OplogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ghi một update (delta) vào oplog.
   * @param docId ID của document
   * @param update Dữ liệu update (dưới dạng mảng số)
   * @param userId ID của người dùng (tùy chọn)
   */
  async append(docId: string, update: number[], userId?: string) {
    // Prisma không hỗ trợ trực tiếp Buffer, nên ta lưu dưới dạng Json array of numbers
    const updateJson = update as unknown as Prisma.JsonArray;

    return this.prisma.operation.create({
      data: {
        docId,
        op: updateJson,
        userId,
      },
    });
  }

  /**
   * Lấy các operations trong một khoảng seq.
   * @param docId ID của document
   * @param fromSeq Lấy từ seq này (lớn hơn)
   */
  async range(docId: string, fromSeq: number) {
    return this.prisma.operation.findMany({
      where: {
        docId,
        seq: {
          gt: fromSeq,
        },
      },
      orderBy: {
        seq: 'asc',
      },
    });
  }

  async latestSeq(docId: string): Promise<number> {
    const latestOp = await this.prisma.operation.findFirst({
      where: { docId },
      orderBy: { seq: 'desc' },
    });
    return latestOp?.seq ?? 0;
  }
}
