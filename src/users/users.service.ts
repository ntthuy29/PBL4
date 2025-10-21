import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateUserDto) {
    return this.prisma.user.create({ data });
  }
  findAll() {
    return this.prisma.user.findMany();
  }
  findOne(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
  remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}
