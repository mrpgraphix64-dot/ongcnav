import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterEmployeeDto } from './register-employee.dto';
import { EmployeeCategory } from '@ongc/shared-types';

function baseInput() {
  return {
    cpf: '123456',
    name: 'Amit Sharma',
    designation: 'ONGC Employee',
    department: 'EWC Ahmedabad',
    phone: '9876543210',
    email: 'amit@ongc.co.in',
    employeeCategory: EmployeeCategory.REGULAR,
    bookingDays: ['2026-10-11'],
  };
}

describe('RegisterEmployeeDto validation', () => {
  it('accepts a valid employeeCategory value', async () => {
    const dto = plainToInstance(RegisterEmployeeDto, baseInput());
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it.each(['REGULAR', 'RETIRED', 'CONTRACT'])('accepts %s as a valid employeeCategory', async (value) => {
    const dto = plainToInstance(RegisterEmployeeDto, { ...baseInput(), employeeCategory: value });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid employeeCategory value', async () => {
    const dto = plainToInstance(RegisterEmployeeDto, { ...baseInput(), employeeCategory: 'NOT_A_REAL_CATEGORY' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'employeeCategory')).toBe(true);
  });

  it('rejects a missing employeeCategory', async () => {
    const input: any = baseInput();
    delete input.employeeCategory;
    const dto = plainToInstance(RegisterEmployeeDto, input);
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'employeeCategory')).toBe(true);
  });

  it('rejects an empty bookingDays array for the employee (still requires at least one date)', async () => {
    const dto = plainToInstance(RegisterEmployeeDto, { ...baseInput(), bookingDays: [] });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'bookingDays')).toBe(true);
  });

  it("allows a family member's bookingDays to be a valid array without one on the employee's own family member DTO required list", async () => {
    const dto = plainToInstance(RegisterEmployeeDto, {
      ...baseInput(),
      familyMembers: [{ name: 'Sunita', relation: 'Spouse', bookingDays: ['2026-10-13'] }],
    });
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
  });
});
