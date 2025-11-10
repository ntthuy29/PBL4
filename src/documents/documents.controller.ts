import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { YDocManager } from '../collab/ydoc-manager';
import { OplogService } from '../collab/oplog.service';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly ydocManager: YDocManager,
    private readonly oplogService: OplogService,
  ) {}

  @Post(':id/snapshot')
  forceSnapshot(@Param('id') id: string) {
    this.ydocManager.forceSnapshot(id);
    return { message: `Snapshot for document ${id} is being created.` };
  }

  @Get(':id/oplog')
  getOplog(@Param('id') id: string, @Query('fromSeq') fromSeq: string) {
    return this.oplogService.range(id, parseInt(fromSeq, 10) || 0);
  }
}
