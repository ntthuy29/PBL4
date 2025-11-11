import { IsString, MinLength } from 'class-validator';

export class GoogleAuthCodeDto {
  @IsString()
  @MinLength(4)
  code!: string;
}
