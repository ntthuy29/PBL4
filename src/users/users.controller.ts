import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post() create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
  @Get() findAll() {
    return this.usersService.findAll();
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
  @Delete(':id') remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
