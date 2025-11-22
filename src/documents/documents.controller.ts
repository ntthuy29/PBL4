import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { YDocManager } from '../collab/ydoc-manager';
import { OplogService } from '../collab/oplog.service';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth/jwt-auth.guard';
import { Request } from 'express';
import { DocPermission } from '../acl/doc-permission.decorator';
import { DocPermissionGuard } from '../acl/doc-permission.guard';

type AuthRequest = Request & { user?: { sub?: string } };

@UseGuards(JwtAuthGuard, DocPermissionGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly ydocManager: YDocManager,
    private readonly oplogService: OplogService,
  ) {}

  @Post()
  create(@Req() req: AuthRequest, @Body() dto: CreateDocumentDto) {
    return this.documentsService.create(dto, this.getUserId(req));
  }

  @Get()
  findAll(@Req() req: AuthRequest) {
    return this.documentsService.findAll(this.getUserId(req));
  }

  @Get('my')
  findMyDocuments(@Req() req: AuthRequest) {
    return this.documentsService.findMyDocuments(this.getUserId(req));
  }

  @Get('shared')
  findSharedDocuments(@Req() req: AuthRequest) {
    return this.documentsService.findSharedDocuments(this.getUserId(req));
  }

  @Get('recent')
  findRecentDocuments(@Req() req: AuthRequest) {
    return this.documentsService.findRecentDocuments(this.getUserId(req));
  }

  @Get('starred')
  findStarredDocuments(@Req() req: AuthRequest) {
    return this.documentsService.findStarredDocuments(this.getUserId(req));
  }

  @DocPermission('read')
  @Get(':id')
  findOne(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.documentsService.findOne(id, this.getUserId(req));
  }

  @DocPermission('write')
  @Patch(':id')
  update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(id, dto, this.getUserId(req));
  }

  @DocPermission('admin')
  @Delete(':id')
  remove(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.documentsService.remove(id, this.getUserId(req));
  }

  @DocPermission('admin')
  @Post(':id/snapshot')
  async forceSnapshot(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.documentsService.findOne(id, this.getUserId(req));
    this.ydocManager.forceSnapshot(id);
    return { message: `Snapshot for document ${id} is being created.` };
  }

  @DocPermission('read')
  @Get(':id/oplog')
  async getOplog(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Query('fromSeq') fromSeq: string,
  ) {
    await this.documentsService.findOne(id, this.getUserId(req));
    return this.oplogService.range(id, parseInt(fromSeq, 10) || 0);
  }

  private getUserId(req: AuthRequest) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user context');
    }
    return userId;
  }
}
