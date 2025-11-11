import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterLocalDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;
}
