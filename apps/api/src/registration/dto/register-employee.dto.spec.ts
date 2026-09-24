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
      familyMembers: [{ name: 'Sunita', relation: 'Spouse', phone: '9876543210', bookingDays: ['2026-10-13'] }],
    });
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
  });

  describe('family member mobile number (mandatory)', () => {
    function withFamilyMember(overrides: Record<string, unknown>) {
      return plainToInstance(RegisterEmployeeDto, {
        ...baseInput(),
        familyMembers: [{ name: 'Sunita', relation: 'Spouse', ...overrides }],
      });
    }

    async function familyPhoneErrors(overrides: Record<string, unknown>) {
      const dto = withFamilyMember(overrides);
      const errors = await validate(dto);
      const familyErrors = errors.find((e) => e.property === 'familyMembers');
      const nested = familyErrors?.children?.[0]?.children ?? [];
      return nested.filter((e: any) => e.property === 'phone');
    }

    it('passes with a valid 10-digit family mobile number', async () => {
      const phoneErrors = await familyPhoneErrors({ phone: '9876543210' });
      expect(phoneErrors).toHaveLength(0);
    });

    it('fails when the family mobile number is missing', async () => {
      const phoneErrors = await familyPhoneErrors({});
      expect(phoneErrors.length).toBeGreaterThan(0);
    });

    it('fails when the family mobile number is empty', async () => {
      const phoneErrors = await familyPhoneErrors({ phone: '' });
      expect(phoneErrors.length).toBeGreaterThan(0);
    });

    it('fails with only 9 digits', async () => {
      const phoneErrors = await familyPhoneErrors({ phone: '987654321' });
      expect(phoneErrors.length).toBeGreaterThan(0);
    });

    it('fails with 11 digits', async () => {
      const phoneErrors = await familyPhoneErrors({ phone: '98765432101' });
      expect(phoneErrors.length).toBeGreaterThan(0);
    });

    it('fails with alphabet characters', async () => {
      const phoneErrors = await familyPhoneErrors({ phone: '98765abcde' });
      expect(phoneErrors.length).toBeGreaterThan(0);
    });

    it('fails with symbol characters', async () => {
      const phoneErrors = await familyPhoneErrors({ phone: '98765-4321' });
      expect(phoneErrors.length).toBeGreaterThan(0);
    });

    it('fails when the number does not start with 6-9 (matches the Indian mobile format used elsewhere in the app)', async () => {
      const phoneErrors = await familyPhoneErrors({ phone: '1234567890' });
      expect(phoneErrors.length).toBeGreaterThan(0);
    });
  });

  describe('registrationType validation', () => {
    it('accepts EMPLOYEE registrationType', async () => {
      const dto = plainToInstance(RegisterEmployeeDto, {
        ...baseInput(),
        registrationType: 'EMPLOYEE',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects invalid registrationType values', async () => {
      const dto = plainToInstance(RegisterEmployeeDto, {
        ...baseInput(),
        registrationType: 'INVALID_TYPE',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'registrationType')).toBe(true);
    });
  });
});
