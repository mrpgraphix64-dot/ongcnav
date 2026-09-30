import { RegistrationType } from '@ongc/shared-types';
import { AttendeeSource, getAttendeeSource } from './attendee-source.util';

describe('attendee-source.util', () => {
  it('identifies synthetic load test attendees', () => {
    const res = getAttendeeSource({ isLoadTest: true, ticketNumber: 'LOAD-123' });
    expect(res.source).toBe(AttendeeSource.LOAD_TEST);
    expect(res.label).toBe('LOAD TEST');
    expect(res.sublabel).toBe('Synthetic');
  });

  it('identifies online commercial orders paid via Razorpay', () => {
    const res = getAttendeeSource({
      orderId: BigInt(10),
      order: {
        source: 'PUBLIC',
        paymentMode: 'RAZORPAY',
        razorpayPaymentId: 'pay_123',
      },
    });
    expect(res.source).toBe(AttendeeSource.ONLINE);
    expect(res.label).toBe('ONLINE');
    expect(res.sublabel).toBe('Razorpay');
  });

  it('identifies agent commercial orders and extracts agent name', () => {
    const res = getAttendeeSource({
      orderId: BigInt(20),
      order: {
        source: 'AGENT',
        paymentMode: 'OFFLINE',
        agent: {
          id: BigInt(5),
          name: 'Hiren Patel',
          email: 'hiren@example.com',
        },
      },
    });
    expect(res.source).toBe(AttendeeSource.AGENT);
    expect(res.label).toBe('AGENT');
    expect(res.agentName).toBe('Hiren Patel');
    expect(res.sublabel).toBe('Hiren Patel');
  });

  it('identifies free/complimentary commercial orders', () => {
    const res = getAttendeeSource({
      orderId: BigInt(30),
      order: {
        source: 'FREE',
        paymentMode: 'COMPLIMENTARY',
        unitPricePaise: 0,
      },
    });
    expect(res.source).toBe(AttendeeSource.FREE);
    expect(res.label).toBe('FREE');
    expect(res.sublabel).toBe('Complimentary');
  });

  it('identifies admin created commercial orders', () => {
    const res = getAttendeeSource({
      orderId: BigInt(40),
      order: {
        source: 'ADMIN',
        paymentMode: 'OFFLINE',
      },
    });
    expect(res.source).toBe(AttendeeSource.ADMIN);
    expect(res.label).toBe('ADMIN');
    expect(res.sublabel).toBe('Admin Created');
  });

  it('identifies ONGC employees and family members as EMPLOYEE', () => {
    const empRes = getAttendeeSource({
      employeeId: BigInt(101),
      registrationType: RegistrationType.EMPLOYEE,
      category: 'ONGC STAFF',
    });
    expect(empRes.source).toBe(AttendeeSource.EMPLOYEE);
    expect(empRes.label).toBe('EMPLOYEE');
    expect(empRes.sublabel).toBe('Staff Portal');

    const famRes = getAttendeeSource({
      employeeId: BigInt(101),
      familyMemberId: BigInt(201),
      registrationType: RegistrationType.EMPLOYEE,
      category: 'Family Member',
    });
    expect(famRes.source).toBe(AttendeeSource.EMPLOYEE);
    expect(famRes.label).toBe('EMPLOYEE');
    expect(famRes.sublabel).toBe('Family');
  });

  it('identifies free standalone passes', () => {
    const res = getAttendeeSource({
      registrationType: RegistrationType.FREE,
      category: 'FREE',
      employeeId: null,
      orderId: null,
    });
    expect(res.source).toBe(AttendeeSource.FREE);
    expect(res.label).toBe('FREE');
    expect(res.sublabel).toBe('Free Pass');
  });

  it('identifies standalone admin entries', () => {
    const res = getAttendeeSource({
      name: 'Walk-in VIP',
      category: 'VIP',
      employeeId: null,
      orderId: null,
      familyMemberId: null,
      isLoadTest: false,
    });
    expect(res.source).toBe(AttendeeSource.ADMIN);
    expect(res.label).toBe('ADMIN');
    expect(res.sublabel).toBe('Admin Entry');
  });

  it('supports passing orderOverride for child passes', () => {
    const childPass = {
      id: BigInt(99),
      ticketNumber: 'TKT-99',
      orderId: BigInt(50),
    };
    const parentOrder = {
      source: 'AGENT',
      agent: { name: 'Kavita Shah' },
    };
    const res = getAttendeeSource(childPass, parentOrder);
    expect(res.source).toBe(AttendeeSource.AGENT);
    expect(res.agentName).toBe('Kavita Shah');
  });
});
