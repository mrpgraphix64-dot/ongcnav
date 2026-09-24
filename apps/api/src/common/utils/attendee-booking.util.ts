// Resolves the correct booking days for a single attendee (person), with
// backward compatibility for records created before per-attendee
// bookingDays existed. Every call site that used to read
// `attendee.employee.bookingDays` directly should use this instead — it
// is the single source of truth for "which dates is this specific person
// booked for."
export function resolveBookingDays(attendee: {
  bookingDays?: unknown;
  employee?: { bookingDays?: unknown } | null;
}): string[] {
  if (Array.isArray(attendee.bookingDays) && attendee.bookingDays.length > 0) {
    return attendee.bookingDays as string[];
  }
  if (attendee.employee && Array.isArray(attendee.employee.bookingDays)) {
    return attendee.employee.bookingDays as string[];
  }
  return [];
}
