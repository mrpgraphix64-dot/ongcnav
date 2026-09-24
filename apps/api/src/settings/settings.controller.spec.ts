import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

describe('SettingsController', () => {
  let controller: SettingsController;
  let service: any;

  beforeEach(async () => {
    service = {
      getAllSettings: jest.fn().mockResolvedValue({
        settings: { 'general.event_name': 'ONGC Navratri 2026' },
        groups: { general: { event_name: 'ONGC Navratri 2026' } },
        gates: [],
      }),
      updateGroup: jest.fn().mockResolvedValue({
        success: true,
        message: 'Settings for group scanner saved successfully.',
      }),
      resetEventData: jest.fn().mockResolvedValue({
        success: true,
        message: 'Event data reset completed.',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [{ provide: SettingsService, useValue: service }],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get settings via index', async () => {
    const result = await controller.index();
    expect(result).toBeDefined();
    expect(service.getAllSettings).toHaveBeenCalled();
  });

  it('should update group settings', async () => {
    const req = { user: { id: '1', role: 'SUPER_ADMIN' } } as any;
    const dto = { auto_verify_qr: true };
    const result = await controller.updateGroup('scanner', dto, req);
    expect(result.success).toBe(true);
    expect(service.updateGroup).toHaveBeenCalledWith('scanner', dto, BigInt(1));
  });

  it('should reset event data', async () => {
    const req = { user: { id: '1', role: 'SUPER_ADMIN' } } as any;
    const dto = { confirmation: 'RESET' };
    const result = await controller.resetData(dto, req);
    expect(result.success).toBe(true);
    expect(service.resetEventData).toHaveBeenCalledWith('RESET', BigInt(1));
  });
});
