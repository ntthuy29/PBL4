import { Test, TestingModule } from '@nestjs/testing';
import { OplogService } from './oplog.service';

describe('OplogService', () => {
  let service: OplogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OplogService],
    }).compile();

    service = module.get<OplogService>(OplogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
