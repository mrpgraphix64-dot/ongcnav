import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterEmployeeDto, VerifyEmployeeDto } from './register-employee.dto';
import { EmployeeCategory } from '@ongc/shared-types';

function baseInput() {
  return {
    cpf: '12345',
    name: 'Amit Sharma',
    designation: 'ONGC Employee',
    department: 'EWC Ahmedabad',
    phone: '9876543210',
    email: 'amit@ongc.co.in',
    employeeCategory: EmployeeCategory.REGULAR,
    dateOfBirth: '1988-05-12',
    dateOfJoining: '2015-09-01',
    guidelinesAccepted: true,
    guidelinesAcceptedAt: '2026-10-03T12:00:00.000Z',
    guidelinesVersion: '2026-employee-registration-v1',
    bookingDays: ['2026-10-11'],
  };
}

describe('RegisterEmployeeDto validation', () => {
  it('accepts a valid employeeCategory value', async () => {
    const dto = plainToInstance(RegisterEmployeeDto, baseInput());
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  describe('CPF validation (strictly 5 numeric digits)', () => {
    it('accepts exactly 5 numeric digits', async () => {
      const dto = plainToInstance(RegisterEmployeeDto, { ...baseInput(), cpf: '12345' });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'cpf')).toHaveLength(0);
    });

    it.each(['1234', '123456', '12A45', '12 45', 'ABCDE', '1234-'])(
      'rejects invalid CPF format: %s',
      async (invalidCpf) => {
        const dto = plainToInstance(RegisterEmployeeDto, { ...baseInput(), cpf: invalidCpf });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'cpf')).toBe(true);
      },
    );
  });

  describe('Employee Date of Birth and Date of Joining validation', () => {
    it('accepts valid YYYY-MM-DD dateOfBirth and dateOfJoining', async () => {
      const dto = plainToInstance(RegisterEmployeeDto, {
        ...baseInput(),
        dateOfBirth: '1990-08-15',
        dateOfJoining: '2018-01-10',
      });
      const errors = await validate(dto);
      expect(errors.filter((e) => ['dateOfBirth', 'dateOfJoining'].includes(e.property))).toHaveLength(0);
    });

    it('rejects missing or empty dateOfBirth', async () => {
      const dto = plainToInstance(RegisterEmployeeDto, { ...baseInput(), dateOfBirth: '' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'dateOfBirth')).toBe(true);
    });

    it('rejects malformed dateOfBirth (e.g. 15-08-1990 or text)', async () => {
      const dto = plainToInstance(RegisterEmployeeDto, { ...baseInput(), dateOfBirth: '15-08-1990' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'dateOfBirth')).toBe(true);
    });

    it('rejects missing or empty dateOfJoining', async () => {
      const dto = plainToInstance(RegisterEmployeeDto, { ...baseInput(), dateOfJoining: '' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'dateOfJoining')).toBe(true);
    });

    it('rejects malformed dateOfJoining', async () => {
      const dto = plainToInstance(RegisterEmployeeDto, { ...baseInput(), dateOfJoining: '01/01/2020' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'dateOfJoining')).toBe(true);
    });
  });

  describe('Guidelines acknowledgement validation', () => {
    it('accepts guidelinesAccepted = true', async () => {
      const dto = plainToInstance(RegisterEmployeeDto, {
        ...baseInput(),
        guidelinesAccepted: true,
      });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'guidelinesAccepted')).toHaveLength(0);
    });

    it('rejects missing or false guidelinesAccepted', async () => {
      const dto1 = plainToInstance(RegisterEmployeeDto, { ...baseInput(), guidelinesAccepted: false });
      const errors1 = await validate(dto1);
      expect(errors1.some((e) => e.property === 'guidelinesAccepted')).toBe(true);

      const input: any = baseInput();
      delete input.guidelinesAccepted;
      const dto2 = plainToInstance(RegisterEmployeeDto, input);
      const errors2 = await validate(dto2);
      expect(errors2.some((e) => e.property === 'guidelinesAccepted')).toBe(true);
    });
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

  describe('family member limit (maximum 3)', () => {
    it.each([0, 1, 2, 3])('accepts %i family members', async (count) => {
      const familyMembers = Array.from({ length: count }, (_, i) => ({
        name: `Member ${i + 1}`,
        relation: 'Spouse',
        phone: '9876543210',
        email: `member${i + 1}@example.com`,
        dateOfBirth: '1992-04-10',
        bookingDays: ['2026-10-11'],
      }));
      const dto = plainToInstance(RegisterEmployeeDto, { ...baseInput(), familyMembers });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'familyMembers')).toHaveLength(0);
    });

    it('rejects 4 family members (maximum allowed is 3)', async () => {
      const familyMembers = Array.from({ length: 4 }, (_, i) => ({
        name: `Member ${i + 1}`,
        relation: 'Spouse',
        phone: '9876543210',
        email: `member${i + 1}@example.com`,
        dateOfBirth: '1992-04-10',
        bookingDays: ['2026-10-11'],
      }));
      const dto = plainToInstance(RegisterEmployeeDto, { ...baseInput(), familyMembers });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'familyMembers')).toBe(true);
    });
  });

  it("allows a family member's bookingDays to be a valid array without one on the employee's own family member DTO required list", async () => {
    const dto = plainToInstance(RegisterEmployeeDto, {
      ...baseInput(),
      familyMembers: [
        {
          name: 'Sunita',
          relation: 'Spouse',
          phone: '9876543210',
          email: 'sunita@example.com',
          dateOfBirth: '1990-01-01',
          bookingDays: ['2026-10-13'],
        },
      ],
    });
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
  });

  describe('family member mobile number, email, and DOB (mandatory)', () => {
    function withFamilyMember(overrides: Record<string, unknown>) {
      return plainToInstance(RegisterEmployeeDto, {
        ...baseInput(),
        familyMembers: [{ name: 'Sunita', relation: 'Spouse', phone: '9876543210', email: 'sunita@example.com', dateOfBirth: '1990-01-01', ...overrides }],
      });
    }

    async function familyMemberErrors(overrides: Record<string, unknown>, propertyName: string) {
      const dto = withFamilyMember(overrides);
      const errors = await validate(dto);
      const familyErrors = errors.find((e) => e.property === 'familyMembers');
      const nested = familyErrors?.children?.[0]?.children ?? [];
      return nested.filter((e: any) => e.property === propertyName);
    }

    it('passes with a valid 10-digit family mobile number', async () => {
      const phoneErrors = await familyMemberErrors({ phone: '9876543210' }, 'phone');
      expect(phoneErrors).toHaveLength(0);
    });

    it('fails when the family mobile number is missing', async () => {
      const dto = plainToInstance(RegisterEmployeeDto, {
        ...baseInput(),
        familyMembers: [{ name: 'Sunita', relation: 'Spouse', email: 'sunita@example.com', dateOfBirth: '1990-01-01' }],
      });
      const errors = await validate(dto);
      const familyErrors = errors.find((e) => e.property === 'familyMembers');
      const nested = familyErrors?.children?.[0]?.children ?? [];
      expect(nested.some((e: any) => e.property === 'phone')).toBe(true);
    });

    it('fails with only 9 digits', async () => {
      const phoneErrors = await familyMemberErrors({ phone: '987654321' }, 'phone');
      expect(phoneErrors.length).toBeGreaterThan(0);
    });

    it('fails with 11 digits', async () => {
      const phoneErrors = await familyMemberErrors({ phone: '98765432101' }, 'phone');
      expect(phoneErrors.length).toBeGreaterThan(0);
    });

    it('passes with a valid family email', async () => {
      const emailErrors = await familyMemberErrors({ email: 'valid@example.com' }, 'email');
      expect(emailErrors).toHaveLength(0);
    });

    it('fails when family email is invalid or missing', async () => {
      const invalidEmailErrors = await familyMemberErrors({ email: 'not-an-email' }, 'email');
      expect(invalidEmailErrors.length).toBeGreaterThan(0);

      const dto = plainToInstance(RegisterEmployeeDto, {
        ...baseInput(),
        familyMembers: [{ name: 'Sunita', relation: 'Spouse', phone: '9876543210', dateOfBirth: '1990-01-01' }],
      });
      const errors = await validate(dto);
      const familyErrors = errors.find((e) => e.property === 'familyMembers');
      const nested = familyErrors?.children?.[0]?.children ?? [];
      expect(nested.some((e: any) => e.property === 'email')).toBe(true);
    });

    it('passes with a valid family dateOfBirth', async () => {
      const dobErrors = await familyMemberErrors({ dateOfBirth: '1995-12-25' }, 'dateOfBirth');
      expect(dobErrors).toHaveLength(0);
    });

    it('passes when family dateOfBirth is omitted (optional)', async () => {
      const omittedDobErrors = await familyMemberErrors({}, 'dateOfBirth');
      expect(omittedDobErrors).toHaveLength(0);
    });

    it('fails when family dateOfBirth is provided but malformed', async () => {
      const malformedDobErrors = await familyMemberErrors({ dateOfBirth: '25-12-1995' }, 'dateOfBirth');
      expect(malformedDobErrors.length).toBeGreaterThan(0);
    });

    it.each(['Parents', 'Spouse', 'Child'])(
      'accepts allowed relationship: %s',
      async (validRelation) => {
        const relationErrors = await familyMemberErrors({ relation: validRelation }, 'relation');
        expect(relationErrors).toHaveLength(0);
      },
    );

    it.each(['Sibling', 'Friend', 'Brother', 'Sister', 'Cousin', 'Other', ''])(
      'rejects unauthorized relationship: %s',
      async (invalidRelation) => {
        const relationErrors = await familyMemberErrors({ relation: invalidRelation }, 'relation');
        expect(relationErrors.length).toBeGreaterThan(0);
      },
    );
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

  describe('VerifyEmployeeDto validation', () => {
    it('accepts 5-digit CPF and 10-digit mobile starting with 6-9', async () => {
      const dto = plainToInstance(VerifyEmployeeDto, { cpf: '12345', mobile: '9876543210' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects non-5-digit CPF', async () => {
      const dto = plainToInstance(VerifyEmployeeDto, { cpf: '1234', mobile: '9876543210' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'cpf')).toBe(true);
    });

    it('rejects invalid mobile', async () => {
      const dto = plainToInstance(VerifyEmployeeDto, { cpf: '12345', mobile: '1234567890' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'mobile')).toBe(true);
    });
  });
});
