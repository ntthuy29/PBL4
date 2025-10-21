import { SetMetadata } from '@nestjs/common';

export const UserId = (...args: string[]) => SetMetadata('user-id', args);
