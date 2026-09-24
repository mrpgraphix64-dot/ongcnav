import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';

describe('RegistrationController', () => {
  let controller: RegistrationController;
  let service: any;

  beforeEach(async () => {
    service = {
      register: jest.fn().mockResolvedValue({ success: true }),
      findTicketByToken: jest.fn(),
      findByCpf: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RegistrationController],
      providers: [{ provide: RegistrationService, useValue: service }],
    }).compile();

    controller = module.get<RegistrationController>(RegistrationController);
  });

  const baseBody = {
    cpf: '123456',
    name: 'Amit Sharma',
    designation: 'ONGC Employee',
    department: 'EWC Ahmedabad',
    phone: '9876543210',
    email: 'amit@ongc.co.in',
    employeeCategory: 'REGULAR',
    bookingDays: JSON.stringify(['2026-10-11']),
    familyMembers: JSON.stringify([
      { name: 'Sunita Sharma', relation: 'Spouse', bookingDays: ['2026-10-13'] },
      { name: 'Rohan Sharma', relation: 'Son', bookingDays: ['2026-10-14'] },
    ]),
  };

  it('parses the employee photo and passes its path to the service', async () => {
    const files = { photo: [{ filename: 'photo-1.jpg' }] } as any;
    await controller.register(baseBody, files);

    expect(service.register).toHaveBeenCalledWith(
      expect.objectContaining({ employeeCategory: 'REGULAR' }),
      'storage/private/employee_photos/photo-1.jpg',
      expect.any(Array),
    );
  });

  it('maps family photos to the correct family member by index, leaving gaps for missing ones', async () => {
    const files = {
      photo: [{ filename: 'photo-1.jpg' }],
      // Only the second family member (index 1) has a photo.
      familyPhoto_1: [{ filename: 'familyPhoto_1-123.jpg' }],
    } as any;

    await controller.register(baseBody, files);

    const [, , familyPhotoPaths] = service.register.mock.calls[0];
    expect(familyPhotoPaths).toEqual([
      undefined,
      'storage/private/family_photos/familyPhoto_1-123.jpg',
    ]);
  });

  it('handles a request with no photos at all', async () => {
    await controller.register(baseBody, undefined);

    const [dto, photoPath, familyPhotoPaths] = service.register.mock.calls[0];
    expect(photoPath).toBeUndefined();
    expect(familyPhotoPaths).toEqual([undefined, undefined]);
    expect(dto.familyMembers).toHaveLength(2);
  });

  it('parses bookingDays and familyMembers JSON strings from multipart form-data', async () => {
    await controller.register(baseBody, undefined);

    const [dto] = service.register.mock.calls[0];
    expect(dto.bookingDays).toEqual(['2026-10-11']);
    expect(dto.familyMembers[0].bookingDays).toEqual(['2026-10-13']);
    expect(dto.familyMembers[1].bookingDays).toEqual(['2026-10-14']);
  });

  it('getTicket delegates to the service', async () => {
    service.findTicketByToken.mockResolvedValue({ ticketNumber: 'TK-1' });
    const result = await controller.getTicket('tok-1');
    expect(result.ticketNumber).toBe('TK-1');
    expect(service.findTicketByToken).toHaveBeenCalledWith('tok-1');
  });

  it('getMyRegistration delegates to the service', async () => {
    service.findByCpf.mockResolvedValue({ employee: { cpf: '123456' } });
    const result = await controller.getMyRegistration('123456', '3210');
    expect(result.employee.cpf).toBe('123456');
    expect(service.findByCpf).toHaveBeenCalledWith('123456', '3210');
  });
});
