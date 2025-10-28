import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsEmail() email: string;
  @IsOptional() @IsString() name?: string;
  @IsString() @IsNotEmpty() password: string;
}
