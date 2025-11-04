import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // Giả sử bạn có PrismaService
import * as Y from 'yjs';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async getDocumentSnapshot(docId: string): Promise<Buffer | null> {
    const content = await this.prisma.documentContent.findUnique({
      where: { docId },
    });
    // Dữ liệu snapshot được lưu dưới dạng JSON, cần chuyển đổi
    if (content?.snapshot) {
      // Prisma trả về JSON, nhưng y-websocket/yjs cần Uint8Array/Buffer
      // Chúng ta cần đảm bảo dữ liệu được lưu đúng định dạng.
      // Giả sử snapshot được lưu dưới dạng mảng số.
      const snapshotArray = JSON.parse(content.snapshot as string);
      return Buffer.from(snapshotArray);
    }
    return null;
  }
}
