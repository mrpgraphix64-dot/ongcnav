export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'EVENT_ADMIN',
  EVENT_ADMIN = 'EVENT_ADMIN',
  GATE_SUPERVISOR = 'GATE_MANAGER',
  GATE_MANAGER = 'GATE_MANAGER',
  GATE_OPERATOR = 'SCANNER_STAFF',
  SCANNER_STAFF = 'SCANNER_STAFF',
  HELP_DESK = 'REGISTRATION_STAFF',
  REGISTRATION_STAFF = 'REGISTRATION_STAFF',
  EMPLOYEE_ADMIN = 'EMPLOYEE_ADMIN',
  COMMERCIAL_ADMIN = 'COMMERCIAL_ADMIN',
  COMMERCIAL_AGENT = 'COMMERCIAL_AGENT',
  COMMERCIAL_SUB_AGENT = 'COMMERCIAL_SUB_AGENT',
  VOLUNTEER = 'REPORT_VIEWER',
  REPORT_VIEWER = 'REPORT_VIEWER',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum GateType {
  REGULAR = 'General',
  GENERAL = 'General',
  VIP = 'VIP',
  STAFF = 'Staff',
  OFFICIAL = 'Staff',
  SERVICE = 'Service',
  EMERGENCY = 'Service',
}

export enum GateStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum TicketCategory {
  ONGC_STAFF = 'ONGC STAFF',
  FAMILY_MEMBER = 'FAMILY MEMBER',
  GENERAL = 'General',
  VIP = 'VIP',
  VVIP = 'VVIP',
}

export enum AttendeeStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  CHECKED_IN = 'checked_in',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended',
  REVOKED = 'revoked',
}

export enum RegistrationType {
  EMPLOYEE = 'EMPLOYEE',
  COMMERCIAL = 'COMMERCIAL',
  FREE = 'FREE',
}

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

export enum EmployeeCategory {
  REGULAR = 'REGULAR',
  RETIRED = 'RETIRED',
  CONTRACT = 'CONTRACT',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum PaymentStatus {
  CREATED = 'CREATED',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum CheckinStatus {
  ACTIVE = 'active',
  SUCCESS = 'active',
  VOIDED = 'voided',
}

export enum CheckinResult {
  SUCCESS = 'SUCCESS',
  ALREADY_CHECKED_IN = 'ALREADY_CHECKED_IN',
  NOT_BOOKED_TODAY = 'NOT_BOOKED_TODAY',
  INVALID_QR = 'INVALID_QR',
  EVENT_CLOSED = 'EVENT_CLOSED',
  SCANNING_PAUSED = 'SCANNING_PAUSED',
  GATE_CLOSED = 'GATE_CLOSED',
  GATE_FULL = 'GATE_FULL',
  UNAUTHORIZED_GATE = 'UNAUTHORIZED_GATE',
  STAFF_INACTIVE = 'STAFF_INACTIVE',
  ATTENDEE_INACTIVE = 'ATTENDEE_INACTIVE',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVER_ERROR = 'SERVER_ERROR',
  ERROR = 'SERVER_ERROR',
}

export enum IncidentCategory {
  SECURITY = 'SECURITY',
  CROWD = 'CAPACITY_LIMIT',
  MEDICAL = 'MEDICAL',
  VIP = 'TICKET_ISSUE',
  SYSTEM = 'OTHER',
  OTHER = 'OTHER',
  TICKET_ISSUE = 'TICKET_ISSUE',
  CAPACITY_LIMIT = 'CAPACITY_LIMIT',
  DUPLICATE_CLAIM = 'DUPLICATE_CLAIM',
  LOST_FOUND = 'LOST_FOUND',
}

export enum IncidentSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum IncidentStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_REVIEW',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
  CLOSED = 'RESOLVED',
}

export enum LoadTestMode {
  DRY_RUN = 'DRY_RUN',
  REAL_HTTP = 'REAL_HTTP',
}

export enum LoadTestStatus {
  PREPARING = 'PREPARING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum LoadTestCleanupStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum LoadTestScenario {
  NORMAL = 'NORMAL',
  DUPLICATE = 'DUPLICATE',
  INVALID_QR = 'INVALID_QR',
  NOT_BOOKED = 'NOT_BOOKED',
  PEAK_BURST = 'PEAK_BURST',
  MIXED = 'MIXED',
}

export enum ScannerConnectionState {
  ONLINE = 'ONLINE',
  UNSTABLE = 'UNSTABLE',
  OFFLINE = 'OFFLINE',
}

export interface CheckinRequestDto {
  ticketId: string;
  gateId?: string | number;
  isManual?: boolean;
  manualReason?: string;
  staffId?: string | number;
  loadTestRunId?: string;
}

export interface CheckinResponseDto {
  success: boolean;
  result: CheckinResult;
  status: string;
  message: string;
  time?: string;
  date?: string;
  gate?: string;
  staff?: string;
  attendee?: {
    id: string | number;
    name: string;
    ticketId: string;
    category?: string;
    gate?: string;
    staff?: string;
    date?: string;
    time?: string;
    checkedInAt?: string;
    duplicateAttempts?: number;
    isManual?: boolean;
  };
  errorReason?: string;
}

export interface ScannerPingResponseDto {
  success: boolean;
  serverTime: string;
  eventStatus: 'open' | 'closed';
  scanningEnabled: boolean;
  emergencyStopped: boolean;
  activeDate: string;
}

export interface ScannerHeartbeatDto {
  staffId: string | number;
  gateId: string | number;
  deviceId: string;
  timestamp: string;
}

export interface ScannerHeartbeatResponseDto {
  status: ScannerConnectionState;
  acknowledgedAt: string;
  serverTime: string;
}

export interface PublicRegistrationDto {
  name: string;
  mobileNo: string;
  cpfNo: string;
  dob: string;
  dateOfJoining: string;
  familyMembers?: Array<{
    name: string;
    mobileNo?: string;
  }>;
}

export interface PublicRegistrationResponseDto {
  success: boolean;
  reference: string;
  message: string;
  tickets: Array<{
    ticketId: string;
    name: string;
    category: string;
    secureToken: string;
    qrSvg: string;
  }>;
}

export type AdminDomain = 'commercial' | 'employee' | 'shared' | 'global';

export const ADMIN_DOMAINS = {
  COMMERCIAL: 'commercial',
  EMPLOYEE: 'employee',
  SHARED: 'shared',
  GLOBAL: 'global',
} as const;

export interface PagePermissionDefinition {
  key: string;
  label: string;
  description: string;
  domain: 'commercial' | 'employee';
  routes: string[];
}

/**
 * Dedicated Page Permissions for E-Pass Admin (COMMERCIAL_ADMIN).
 * Hard domain boundary: Cannot contain any employee or global keys.
 */
export const E_PASS_ADMIN_PAGE_PERMISSIONS: PagePermissionDefinition[] = [
  {
    key: 'commercial.dashboard',
    label: 'Dashboard',
    description: 'Access to Commercial Dashboard overview and metrics',
    domain: 'commercial',
    routes: ['/admin', '/admin/commercial'],
  },
  {
    key: 'commercial.orders',
    label: 'E-Pass Orders',
    description: 'View, filter, and manage commercial e-pass transactions and orders',
    domain: 'commercial',
    routes: ['/admin/commercial/orders'],
  },
  {
    key: 'commercial.customers',
    label: 'Customers & Passes',
    description: 'Manage commercial ticket purchasers and booked passes',
    domain: 'commercial',
    routes: ['/admin/commercial/customers', '/admin/commercial/bookings'],
  },
  {
    key: 'commercial.agents',
    label: 'Agents',
    description: 'Manage authorized physical and online ticket sales agents',
    domain: 'commercial',
    routes: ['/admin/commercial/agents'],
  },
  {
    key: 'commercial.inventory',
    label: 'Inventory',
    description: 'View total pass capacities, allocated seats, and daily remaining quotas',
    domain: 'commercial',
    routes: ['/admin/commercial/inventory'],
  },
  {
    key: 'commercial.allocations',
    label: 'Allocations',
    description: 'Manage ticket quotas and batch pass distributions to agents',
    domain: 'commercial',
    routes: ['/admin/commercial/allocations'],
  },
  {
    key: 'commercial.reports',
    label: 'Reports',
    description: 'Access commercial revenue, sales settlement, and audit reports',
    domain: 'commercial',
    routes: ['/admin/commercial/reports'],
  },
  {
    key: 'commercial.tickets',
    label: 'Ticket Delivery',
    description: 'Resend e-pass emails and access printable ticket batches',
    domain: 'commercial',
    routes: ['/admin/commercial/tickets'],
  },
];

/**
 * Dedicated Page Permissions for Employee Admin (EMPLOYEE_ADMIN).
 * Hard domain boundary: Cannot contain any commercial or global keys.
 */
export const EMPLOYEE_ADMIN_PAGE_PERMISSIONS: PagePermissionDefinition[] = [
  {
    key: 'employee.dashboard',
    label: 'Dashboard',
    description: 'Access to Employee Dashboard overview and metrics',
    domain: 'employee',
    routes: ['/admin', '/admin/employee'],
  },
  {
    key: 'employee.attendees',
    label: 'Employee Registrations',
    description: 'Search, view, and manage ONGC employee registrations',
    domain: 'employee',
    routes: ['/admin/attendees'],
  },
  {
    key: 'employee.family_passes',
    label: 'Employee & Family Passes',
    description: 'Manage employee family members and accompanying guest passes',
    domain: 'employee',
    routes: ['/admin/attendees'],
  },
  {
    key: 'employee.bulk_upload',
    label: 'Bulk Upload',
    description: 'Import employee CSV rosters and batch updates',
    domain: 'employee',
    routes: ['/admin/bulk-upload'],
  },
  {
    key: 'employee.reports',
    label: 'Reports',
    description: 'Access employee attendance, category, and audit reports',
    domain: 'employee',
    routes: ['/admin/reports'],
  },
  {
    key: 'employee.operations',
    label: 'Operations',
    description: 'Help Desk overrides and daily closing operations',
    domain: 'employee',
    routes: ['/admin/helpdesk', '/admin/help-desk', '/admin/daily-closing'],
  },
];

export const E_PASS_ADMIN_PAGE_KEYS = E_PASS_ADMIN_PAGE_PERMISSIONS.map((p) => p.key);
export const EMPLOYEE_ADMIN_PAGE_KEYS = EMPLOYEE_ADMIN_PAGE_PERMISSIONS.map((p) => p.key);

/**
 * Returns safe default page permissions for a given role.
 * Ensures existing domain admins do not suffer lockouts if no custom setting row exists.
 */
export function getDefaultPermissionsForRole(role?: string): string[] {
  if (!role) return [];
  const r = role.toUpperCase().trim();
  if (r === 'COMMERCIAL_ADMIN') {
    return [...E_PASS_ADMIN_PAGE_KEYS];
  }
  if (r === 'EMPLOYEE_ADMIN') {
    return [...EMPLOYEE_ADMIN_PAGE_KEYS];
  }
  if (r === 'SUPER_ADMIN') {
    return [...E_PASS_ADMIN_PAGE_KEYS, ...EMPLOYEE_ADMIN_PAGE_KEYS];
  }
  return [];
}

/**
 * Validates that all requested permissions belong exclusively to the role's allowed domain.
 * Strictly prevents cross-domain permission assignments.
 */
export function validatePermissionsForRole(
  role: string,
  permissions: string[],
): { valid: boolean; invalidKeys: string[] } {
  const r = role.toUpperCase().trim();
  if (r === 'SUPER_ADMIN') {
    return { valid: true, invalidKeys: [] };
  }

  let allowedKeys: string[] = [];
  if (r === 'COMMERCIAL_ADMIN') {
    allowedKeys = E_PASS_ADMIN_PAGE_KEYS;
  } else if (r === 'EMPLOYEE_ADMIN') {
    allowedKeys = EMPLOYEE_ADMIN_PAGE_KEYS;
  } else {
    return { valid: false, invalidKeys: permissions };
  }

  const invalidKeys = permissions.filter((key) => !allowedKeys.includes(key));
  return {
    valid: invalidKeys.length === 0,
    invalidKeys,
  };
}

/**
 * Route mappings for domain-separated page access.
 */
export const DOMAIN_PAGE_ROUTES: Record<AdminDomain, string[]> = {
  commercial: [
    '/admin/commercial',
    '/admin/commercial/orders',
    '/admin/commercial/agents',
    '/admin/commercial/agents/[id]',
    '/admin/commercial/inventory',
    '/admin/commercial/allocations',
    '/admin/commercial/bookings',
    '/admin/commercial/customers',
    '/admin/commercial/reports',
    '/admin/commercial/tickets',
  ],
  employee: [
    '/admin/attendees',
    '/admin/bulk-upload',
    '/admin/employee',
    '/admin/helpdesk',
    '/admin/help-desk',
    '/admin/daily-closing',
    '/admin/reports',
  ],
  shared: [
    '/admin',
  ],
  global: [
    '/admin/event-control',
    '/admin/gates',
    '/admin/staff',
    '/admin/settings',
    '/admin/traffic-test',
  ],
};

/**
 * Evaluates whether a given route pathname is permitted for a specific user role
 * and their granular page permissions (if configured).
 *
 * Scanner Access Rule:
 * Dedicated domain admins (COMMERCIAL_ADMIN and EMPLOYEE_ADMIN) do NOT have /scanner access.
 * Turnstile scanning is reserved for operational roles (SCANNER_STAFF, GATE_MANAGER, EVENT_ADMIN, SUPER_ADMIN).
 */
export function isRoutePermittedForRole(
  pathname: string,
  userRole?: string,
  userPermissions?: string[],
): boolean {
  if (!pathname) return false;
  const cleanPath = pathname.split('?')[0].replace(/\/+$/, '') || '/admin';

  if (!userRole) return false;
  const role = userRole.toUpperCase().trim();

  // 1. SUPER_ADMIN: full unrestricted access to everything
  if (role === 'SUPER_ADMIN') {
    return true;
  }

  // 2. COMMERCIAL_ADMIN (E-Pass Admin): Commercial domain ONLY. Scanner is FORBIDDEN.
  if (role === 'COMMERCIAL_ADMIN') {
    // Explicitly blocked routes & domains
    if (
      cleanPath === '/scanner' ||
      cleanPath.startsWith('/scanner/') ||
      cleanPath.startsWith('/admin/attendees') ||
      cleanPath.startsWith('/admin/bulk-upload') ||
      cleanPath.startsWith('/admin/employee') ||
      cleanPath.startsWith('/admin/helpdesk') ||
      cleanPath.startsWith('/admin/help-desk') ||
      cleanPath.startsWith('/admin/daily-closing') ||
      cleanPath.startsWith('/admin/reports') ||
      cleanPath.startsWith('/admin/staff') ||
      cleanPath.startsWith('/admin/event-control') ||
      cleanPath.startsWith('/admin/gates') ||
      cleanPath.startsWith('/admin/settings') ||
      cleanPath.startsWith('/admin/traffic-test')
    ) {
      return false;
    }

    // Check granular page permissions if provided
    const perms = userPermissions ?? getDefaultPermissionsForRole('COMMERCIAL_ADMIN');

    if (cleanPath === '/admin' || cleanPath === '/admin/commercial') {
      return perms.includes('commercial.dashboard');
    }
    if (cleanPath.startsWith('/admin/commercial/orders')) {
      return perms.includes('commercial.orders');
    }
    if (cleanPath.startsWith('/admin/commercial/customers') || cleanPath.startsWith('/admin/commercial/bookings')) {
      return perms.includes('commercial.customers');
    }
    if (cleanPath.startsWith('/admin/commercial/agents')) {
      return perms.includes('commercial.agents');
    }
    if (cleanPath.startsWith('/admin/commercial/inventory')) {
      return perms.includes('commercial.inventory');
    }
    if (cleanPath.startsWith('/admin/commercial/allocations')) {
      return perms.includes('commercial.allocations');
    }
    if (cleanPath.startsWith('/admin/commercial/reports')) {
      return perms.includes('commercial.reports');
    }
    if (cleanPath.startsWith('/admin/commercial/tickets')) {
      return perms.includes('commercial.tickets');
    }

    return false;
  }

  // 3. EMPLOYEE_ADMIN (Employee Admin): Employee domain ONLY. Scanner is FORBIDDEN.
  if (role === 'EMPLOYEE_ADMIN') {
    // Explicitly blocked routes & domains
    if (
      cleanPath === '/scanner' ||
      cleanPath.startsWith('/scanner/') ||
      cleanPath.startsWith('/admin/commercial') ||
      cleanPath.startsWith('/agent') ||
      cleanPath.startsWith('/admin/staff') ||
      cleanPath.startsWith('/admin/event-control') ||
      cleanPath.startsWith('/admin/gates') ||
      cleanPath.startsWith('/admin/settings') ||
      cleanPath.startsWith('/admin/traffic-test')
    ) {
      return false;
    }

    // Check granular page permissions if provided
    const perms = userPermissions ?? getDefaultPermissionsForRole('EMPLOYEE_ADMIN');

    if (cleanPath === '/admin' || cleanPath === '/admin/employee') {
      return perms.includes('employee.dashboard');
    }
    if (cleanPath.startsWith('/admin/attendees')) {
      return perms.includes('employee.attendees') || perms.includes('employee.family_passes');
    }
    if (cleanPath.startsWith('/admin/bulk-upload')) {
      return perms.includes('employee.bulk_upload');
    }
    if (cleanPath.startsWith('/admin/reports')) {
      return perms.includes('employee.reports');
    }
    if (
      cleanPath.startsWith('/admin/helpdesk') ||
      cleanPath.startsWith('/admin/help-desk') ||
      cleanPath.startsWith('/admin/daily-closing')
    ) {
      return perms.includes('employee.operations');
    }

    return false;
  }

  // 4. EVENT_ADMIN / ADMIN
  if (role === 'EVENT_ADMIN' || role === 'ADMIN') {
    if (cleanPath.startsWith('/admin/commercial') || cleanPath.startsWith('/agent')) {
      return false;
    }
    return (
      cleanPath === '/admin' ||
      cleanPath.startsWith('/admin/event-control') ||
      cleanPath.startsWith('/admin/gates') ||
      cleanPath.startsWith('/admin/staff') ||
      cleanPath.startsWith('/admin/incidents') ||
      cleanPath.startsWith('/admin/daily-closing') ||
      cleanPath.startsWith('/admin/reports') ||
      cleanPath.startsWith('/admin/settings') ||
      cleanPath.startsWith('/admin/traffic-test') ||
      cleanPath.startsWith('/admin/helpdesk') ||
      cleanPath.startsWith('/admin/help-desk') ||
      cleanPath === '/scanner'
    );
  }

  // 5. REGISTRATION_STAFF / HELP_DESK
  if (role === 'REGISTRATION_STAFF' || role === 'HELP_DESK') {
    return (
      cleanPath === '/admin' ||
      cleanPath.startsWith('/admin/attendees') ||
      cleanPath.startsWith('/admin/bulk-upload') ||
      cleanPath.startsWith('/admin/helpdesk') ||
      cleanPath.startsWith('/admin/help-desk')
    );
  }

  // 6. GATE_MANAGER / GATE_SUPERVISOR
  if (role === 'GATE_MANAGER' || role === 'GATE_SUPERVISOR') {
    return (
      cleanPath === '/admin' ||
      cleanPath.startsWith('/admin/gates') ||
      cleanPath.startsWith('/admin/incidents') ||
      cleanPath.startsWith('/admin/daily-closing') ||
      cleanPath.startsWith('/admin/reports') ||
      cleanPath.startsWith('/admin/helpdesk') ||
      cleanPath.startsWith('/admin/help-desk') ||
      cleanPath === '/scanner'
    );
  }

  // 7. SCANNER_STAFF / GATE_OPERATOR
  if (role === 'SCANNER_STAFF' || role === 'GATE_OPERATOR') {
    return (
      cleanPath === '/scanner' ||
      cleanPath.startsWith('/admin/my-gate') ||
      cleanPath.startsWith('/admin/helpdesk') ||
      cleanPath.startsWith('/admin/help-desk') ||
      cleanPath.startsWith('/admin/incidents')
    );
  }

  // 8. REPORT_VIEWER / VOLUNTEER
  if (role === 'REPORT_VIEWER' || role === 'VOLUNTEER') {
    return (
      cleanPath === '/admin' ||
      cleanPath.startsWith('/admin/reports') ||
      cleanPath.startsWith('/admin/daily-closing')
    );
  }

  // 9. COMMERCIAL_AGENT / COMMERCIAL_SUB_AGENT
  if (role === 'COMMERCIAL_AGENT' || role === 'COMMERCIAL_SUB_AGENT') {
    return cleanPath.startsWith('/agent');
  }

  return false;
}

// ---------------------------------------------------------------------------
// SUPER_ADMIN CONTROL CENTER & SYSTEM SETTINGS
// ---------------------------------------------------------------------------

export const SETTING_SUPER_ADMIN_FULL_POWER = 'system.super_admin_full_power';
export const SETTING_MAINTENANCE_MODE = 'system.maintenance_mode';
export const SETTING_PAYMENT_RAZORPAY_ENABLED = 'payment.razorpay_enabled';
export const SETTING_BOOK_PASS_AVAILABILITY = 'commercial.book_pass_availability';

export enum BookPassAvailability {
  OPEN = 'OPEN',
  COMING_SOON = 'COMING_SOON',
}

export const CONFIRMATION_ENABLE_FULL_POWER = 'ENABLE FULL POWER';
export const CONFIRMATION_ENABLE_MAINTENANCE = 'ENABLE MAINTENANCE';

// Audit Log Action Identifiers
export const AUDIT_SUPER_ADMIN_FULL_POWER_ENABLED = 'SUPER_ADMIN_FULL_POWER_ENABLED';
export const AUDIT_SUPER_ADMIN_FULL_POWER_DISABLED = 'SUPER_ADMIN_FULL_POWER_DISABLED';
export const AUDIT_MAINTENANCE_MODE_ENABLED = 'MAINTENANCE_MODE_ENABLED';
export const AUDIT_MAINTENANCE_MODE_DISABLED = 'MAINTENANCE_MODE_DISABLED';
export const AUDIT_PAYMENT_GATEWAY_ENABLED = 'PAYMENT_GATEWAY_ENABLED';
export const AUDIT_PAYMENT_GATEWAY_DISABLED = 'PAYMENT_GATEWAY_DISABLED';
export const AUDIT_BOOK_PASS_AVAILABILITY_UPDATED = 'BOOK_PASS_AVAILABILITY_UPDATED';
export const AUDIT_FULL_POWER_ATTENDEE_DELETED = 'FULL_POWER_ATTENDEE_DELETED';
export const AUDIT_FULL_POWER_ATTENDEES_BULK_DELETED = 'FULL_POWER_ATTENDEES_BULK_DELETED';
export const AUDIT_FULL_POWER_ORDER_DELETED = 'FULL_POWER_ORDER_DELETED';
export const AUDIT_FULL_POWER_ORDERS_BULK_DELETED = 'FULL_POWER_ORDERS_BULK_DELETED';

export function isSuperAdminFullPowerActive(
  userRole?: string | null,
  isSettingEnabled?: boolean | string | null,
  nodeEnv?: string | null,
): boolean {
  const procEnv = (globalThis as any)?.process?.env?.NODE_ENV;
  const env = (nodeEnv || (typeof procEnv === 'string' ? procEnv : '') || '')
    .toLowerCase()
    .trim();

  if (!env || env === 'production') {
    return false;
  }

  const allowedEnvs = ['staging', 'development', 'test', 'local'];
  if (!allowedEnvs.includes(env)) {
    return false;
  }

  const role = (userRole || '').toUpperCase().trim();
  if (role !== UserRole.SUPER_ADMIN) {
    return false;
  }

  if (typeof isSettingEnabled === 'boolean') {
    return isSettingEnabled;
  }
  const flag = String(isSettingEnabled || '').toLowerCase().trim();
  return flag === 'true' || flag === '1';
}

export function isMaintenanceModeActive(isSettingEnabled?: boolean | string | null): boolean {
  if (typeof isSettingEnabled === 'boolean') {
    return isSettingEnabled;
  }
  const flag = String(isSettingEnabled || '').toLowerCase().trim();
  return flag === 'true' || flag === '1';
}

/**
 * Checks whether Book Pass ticket sales are open for public customers.
 * Defaults to true (OPEN) if not explicitly set or empty.
 */
export function isBookPassOpen(isSettingEnabled?: boolean | string | null): boolean {
  if (isSettingEnabled === undefined || isSettingEnabled === null || isSettingEnabled === '') {
    return true;
  }
  if (typeof isSettingEnabled === 'boolean') {
    return isSettingEnabled;
  }
  const flag = String(isSettingEnabled).toUpperCase().trim();
  if (flag === 'COMING_SOON' || flag === 'CLOSED' || flag === '0' || flag === 'FALSE') {
    return false;
  }
  return true;
}
