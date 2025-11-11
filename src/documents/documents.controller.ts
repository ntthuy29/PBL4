import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { YDocManager } from '../collab/ydoc-manager';
import { OplogService } from '../collab/oplog.service';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly ydocManager: YDocManager,
    private readonly oplogService: OplogService,
  ) {}

  @Post()
  create(@Body() dto: CreateDocumentDto) {
    return this.documentsService.create(dto);
  }

  @Get()
  findAll() {
    return this.documentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.documentsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }

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
