import { Test, TestingModule } from '@nestjs/testing';
import { AclController } from './acl.controller';

describe('AclController', () => {
  let controller: AclController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AclController],
    }).compile();

    controller = module.get<AclController>(AclController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
