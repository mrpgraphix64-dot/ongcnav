import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EmployeesService - getPassSummary', () => {
  let service: EmployeesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      attendee: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  it('should return accurate, mathematically reconciled counts excluding isLoadTest: true', async () => {
    // Mock the 7 parallel count queries in getPassSummary:
    // 1. totalPasses = 85
    // 2. websitePasses = 5
    // 3. agentPasses = 1
    // 4. employeePasses = 79
    // 5. freePasses = 0
    // 6. adminPasses = 0
    // 7. checkedInPasses = 30
    prisma.attendee.count
      .mockResolvedValueOnce(85) // total
      .mockResolvedValueOnce(5)  // website
      .mockResolvedValueOnce(1)  // agent
      .mockResolvedValueOnce(79) // employee
      .mockResolvedValueOnce(0)  // free
      .mockResolvedValueOnce(0)  // admin
      .mockResolvedValueOnce(30); // checkedIn

    const result = await service.getPassSummary();

    // Verify all queries enforce isLoadTest: false
    expect(prisma.attendee.count).toHaveBeenCalledTimes(7);
    for (let i = 0; i < 7; i++) {
      const callArg = prisma.attendee.count.mock.calls[i][0];
      expect(callArg.where.isLoadTest).toBe(false);
    }

    // Verify normalized keys match frontend expectations
    expect(result.total).toBe(85);
    expect(result.website).toBe(5);
    expect(result.agent).toBe(1);
    expect(result.employee).toBe(79);
    expect(result.free).toBe(0);
    expect(result.admin).toBe(0);
    expect(result.checkedIn).toBe(30);
    expect(result.notCheckedIn).toBe(55); // 85 - 30

    // Mathematical reconciliation check
    expect(result.website + result.agent + result.employee + result.free + result.admin).toBe(result.total);
    expect(result.checkedIn + result.notCheckedIn).toBe(result.total);

    // Verify backward compatibility aliases
    expect(result.totalPasses).toBe(85);
    expect(result.websitePasses).toBe(5);
    expect(result.agentPasses).toBe(1);
    expect(result.employeePasses).toBe(79);
    expect(result.freePasses).toBe(0);
    expect(result.adminPasses).toBe(0);
    expect(result.checkedInPasses).toBe(30);
    expect(result.notCheckedInPasses).toBe(55);
  });
});
