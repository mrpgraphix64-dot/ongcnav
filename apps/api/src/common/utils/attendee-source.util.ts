import { RegistrationType } from '@ongc/shared-types';

export enum AttendeeSource {
  ONLINE = 'ONLINE',
  AGENT = 'AGENT',
  FREE = 'FREE',
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
  LOAD_TEST = 'LOAD_TEST',
}

export interface AttendeeSourceInfo {
  source: AttendeeSource;
  label: string;
  sublabel?: string;
  agentName?: string;
}

/**
 * Centrally determines the creation SOURCE of an attendee or order pass.
 *
 * Rules:
 * 1. If attendee.isLoadTest is true -> LOAD TEST (Synthetic load test runner)
 * 2. If attendee has an associated CommercialOrder:
 *    - order.source === 'AGENT' || order.agentId != null -> AGENT (sublabel: agent name)
 *    - order.source === 'FREE' || order.paymentMode === 'COMPLIMENTARY' || order.unitPricePaise === 0 -> FREE (sublabel: Complimentary)
 *    - order.source === 'ADMIN' -> ADMIN (sublabel: Admin Created)
 *    - Default for commercial orders (order.source === 'PUBLIC' || Razorpay) -> ONLINE (sublabel: Razorpay / Dev Test)
 * 3. If attendee has employee / family relationship or RegistrationType.EMPLOYEE -> EMPLOYEE (sublabel: Staff Portal / Family)
 * 4. If attendee.registrationType === RegistrationType.FREE -> FREE (sublabel: Free Pass)
 * 5. If attendee has no employeeId, orderId, or familyMemberId -> ADMIN (sublabel: Admin Entry)
 */
export function getAttendeeSource(attendee: any, orderOverride?: any): AttendeeSourceInfo {
  if (!attendee) {
    return {
      source: AttendeeSource.ADMIN,
      label: 'ADMIN',
    };
  }

  // 1. Synthetic load test pass
  if (attendee.isLoadTest || attendee.loadTestRunId != null) {
    return {
      source: AttendeeSource.LOAD_TEST,
      label: 'LOAD TEST',
      sublabel: 'Synthetic',
    };
  }

  // 2. Commercial order pass
  const order = orderOverride || attendee.order || null;
  if (attendee.orderId != null || order != null) {
    if (order) {
      if (order.source === 'AGENT' || order.agentId != null || order.agent != null) {
        const agentName = order.agent?.name || 'Agent';
        return {
          source: AttendeeSource.AGENT,
          label: 'AGENT',
          agentName,
          sublabel: agentName,
        };
      }

      if (
        order.source === 'FREE' ||
        order.paymentMode === 'COMPLIMENTARY' ||
        order.unitPricePaise === 0
      ) {
        return {
          source: AttendeeSource.FREE,
          label: 'FREE',
          sublabel: 'Complimentary',
        };
      }

      if (order.source === 'ADMIN') {
        return {
          source: AttendeeSource.ADMIN,
          label: 'ADMIN',
          sublabel: 'Admin Created',
        };
      }

      // Default commercial: Online public booking
      const sublabel =
        order.paymentMode === 'RAZORPAY'
          ? 'Razorpay'
          : order.source === 'DEVELOPER_TEST'
          ? 'Dev Test'
          : undefined;

      return {
        source: AttendeeSource.ONLINE,
        label: 'ONLINE',
        sublabel,
      };
    }

    return {
      source: AttendeeSource.ONLINE,
      label: 'ONLINE',
    };
  }

  // 3. Employee / Staff / Family Member
  if (
    attendee.employeeId != null ||
    attendee.employee != null ||
    attendee.familyMemberId != null ||
    attendee.category === 'ONGC STAFF' ||
    attendee.category === 'FAMILY MEMBER'
  ) {
    return {
      source: AttendeeSource.EMPLOYEE,
      label: 'EMPLOYEE',
      sublabel: attendee.familyMemberId ? 'Family' : 'Staff Portal',
    };
  }

  // 4. Free standalone pass
  if (
    attendee.registrationType === RegistrationType.FREE ||
    attendee.category?.toUpperCase() === 'FREE' ||
    attendee.category?.toUpperCase() === 'COMPLIMENTARY'
  ) {
    return {
      source: AttendeeSource.FREE,
      label: 'FREE',
      sublabel: 'Free Pass',
    };
  }

  // 5. Standalone attendee added manually via Admin Console
  return {
    source: AttendeeSource.ADMIN,
    label: 'ADMIN',
    sublabel: 'Admin Entry',
  };
}
