import { resolveBookingDays } from './attendee-booking.util';

describe('resolveBookingDays', () => {
  it('returns the attendee’s own bookingDays when present', () => {
    const result = resolveBookingDays({
      bookingDays: ['2026-10-11', '2026-10-12'],
      employee: { bookingDays: ['2026-09-23'] },
    });
    expect(result).toEqual(['2026-10-11', '2026-10-12']);
  });

  it('falls back to employee.bookingDays when the attendee has none set (null)', () => {
    const result = resolveBookingDays({
      bookingDays: null,
      employee: { bookingDays: ['2026-09-23', '2026-09-24'] },
    });
    expect(result).toEqual(['2026-09-23', '2026-09-24']);
  });

  it('falls back to employee.bookingDays when the attendee bookingDays is an empty array', () => {
    const result = resolveBookingDays({
      bookingDays: [],
      employee: { bookingDays: ['2026-10-15'] },
    });
    expect(result).toEqual(['2026-10-15']);
  });

  it('returns an empty array when neither the attendee nor the employee has bookingDays', () => {
    expect(resolveBookingDays({ bookingDays: null, employee: null })).toEqual([]);
    expect(resolveBookingDays({})).toEqual([]);
  });

  it('is independent per attendee — two attendees under the same employee resolve different dates', () => {
    const employee = { bookingDays: ['2026-10-11'] };
    const employeeAttendee = { bookingDays: ['2026-10-12', '2026-10-13'], employee };
    const familyAttendee = { bookingDays: ['2026-10-16'], employee };

    expect(resolveBookingDays(employeeAttendee)).toEqual(['2026-10-12', '2026-10-13']);
    expect(resolveBookingDays(familyAttendee)).toEqual(['2026-10-16']);
  });
});
