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

export enum RegistrationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum DailyPassStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  USED = 'USED',
}

export enum DailyPassEmailStatus {
  PENDING = 'PENDING',
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
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

export const ALLOWED_FAMILY_RELATIONS = ['Parents', 'Spouse', 'Child'] as const;
export type AllowedFamilyRelation = (typeof ALLOWED_FAMILY_RELATIONS)[number];

export type PublicWebsiteMode = 'COMING_SOON' | 'EMPLOYEE_REGISTRATION_ONLY' | 'FULL_WEBSITE';

export interface EmployeeTypeSettings {
  regular: boolean;
  retired: boolean;
  contract: boolean;
}

export interface EmployeeQrReleaseSchedule {
  enabled: boolean;
  releaseDate: string;
  releaseTime: string;
  timezone: string;
  status: 'IDLE' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED';
  lastRunAt?: string | null;
  lastRunMessage?: string | null;
  currentReleaseId?: string | null;
  stats?: {
    eligibleCount: number;
    qrGeneratedCount: number;
    queuedCount?: number;
    sendingCount?: number;
    acceptedCount?: number;
    deliveredCount?: number;
    failedCount: number;
    bouncedCount?: number;
    sentCount: number;
  };
}

export enum EmailDeliveryStatus {
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  ACCEPTED = 'ACCEPTED',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  BOUNCED = 'BOUNCED',
  REJECTED = 'REJECTED',
  DEFERRED = 'DEFERRED',
  CANCELLED = 'CANCELLED',
}

export enum EmailReleaseStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  PARTIAL_FAILURE = 'PARTIAL_FAILURE',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum EmailDeliveryErrorType {
  INVALID_EMAIL = 'INVALID_EMAIL',
  SMTP_AUTH_ERROR = 'SMTP_AUTH_ERROR',
  SMTP_CONNECTION_ERROR = 'SMTP_CONNECTION_ERROR',
  SMTP_TIMEOUT = 'SMTP_TIMEOUT',
  PROVIDER_RATE_LIMIT = 'PROVIDER_RATE_LIMIT',
  PROVIDER_REJECTED = 'PROVIDER_REJECTED',
  MAILBOX_FULL = 'MAILBOX_FULL',
  RECIPIENT_NOT_FOUND = 'RECIPIENT_NOT_FOUND',
  DOMAIN_ERROR = 'DOMAIN_ERROR',
  BOUNCED = 'BOUNCED',
  TEMPORARY_PROVIDER_ERROR = 'TEMPORARY_PROVIDER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface EmployeeQrEmailDeliveryItem {
  id: string;
  releaseId?: string | null;
  attendeeId: string;
  referenceNumber: string;
  recipientEmail: string;
  attendeeName: string;
  employeeName: string;
  relation: string;
  isFamily: boolean;
  cpf: string;
  ticketNumber: string;
  qrCodeToken: string;
  bookingDays: string[];
  status: EmailDeliveryStatus;
  provider: string;
  providerMessageId?: string | null;
  providerEventId?: string | null;
  queuedAt?: string | null;
  startedAt?: string | null;
  acceptedAt?: string | null;
  deliveredAt?: string | null;
  failedAt?: string | null;
  bouncedAt?: string | null;
  rejectedAt?: string | null;
  retryCount: number;
  maxRetries: number;
  errorType?: EmailDeliveryErrorType | null;
  lastError?: string | null;
  lastProviderError?: string | null;
  lastProviderResponse?: string | null;
  isTest: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeQrEmailReleaseSummary {
  id: string;
  releaseType: string;
  status: EmailReleaseStatus;
  startedAt: string;
  completedAt?: string | null;
  totalRecipients: number;
  queuedCount: number;
  sendingCount: number;
  acceptedCount: number;
  deliveredCount: number;
  failedCount: number;
  bouncedCount: number;
  rejectedCount: number;
  deliveryConfirmationAvailable: boolean;
  isTest: boolean;
  createdBy?: string | null;
  createdAt: string;
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
    '/admin/test-lab/employee-daily-pass',
    '/admin/employees/whatsapp-test',
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
      cleanPath.startsWith('/admin/traffic-test') ||
      cleanPath.startsWith('/admin/test-lab') ||
      cleanPath.startsWith('/admin/employees/whatsapp-test')
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
      cleanPath.startsWith('/admin/traffic-test') ||
      cleanPath.startsWith('/admin/test-lab') ||
      cleanPath.startsWith('/admin/employees/whatsapp-test')
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
    if (
      cleanPath.startsWith('/admin/commercial') ||
      cleanPath.startsWith('/agent') ||
      cleanPath.startsWith('/admin/test-lab') ||
      cleanPath.startsWith('/admin/employees/whatsapp-test')
    ) {
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

export interface EmployeeRegistrationDto {
  name: string;
  mobileNo: string;
  cpfNo: string;
  email: string;
  designation?: string;
  department?: string;
  category?: EmployeeCategory;
  bookingDays: string[];
  photoUrl?: string;
  familyMembers?: Array<{
    name: string;
    relationship?: string;
    mobileNo?: string;
    photoUrl?: string;
    bookingDays: string[];
  }>;
}

export interface DailyPassDeliveryStatsDto {
  eventDate: string;
  eligibleCount: number;
  generatedCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  checkedInCount: number;
}

export const OFFICIAL_EVENT_DATES = [
  '2026-10-11',
  '2026-10-12',
  '2026-10-13',
  '2026-10-14',
  '2026-10-15',
  '2026-10-16',
  '2026-10-17',
  '2026-10-18',
  '2026-10-19',
] as const;

export type OfficialEventDate = (typeof OFFICIAL_EVENT_DATES)[number];

export function isOfficialEventDate(date: string): date is OfficialEventDate {
  return (OFFICIAL_EVENT_DATES as readonly string[]).includes(date);
}

export interface EventDayTheme {
  dayNumber: number;
  eventDate: string;
  dayLabel: string;
  monthLabel: string;
  fullDateLabel: string;
  dayOfWeek: string;
  themeTitle: string;
  motifName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  badgeBg: string;
}

export const EVENT_DAY_THEMES: Record<string, EventDayTheme> = {
  '2026-10-11': {
    dayNumber: 1,
    eventDate: '2026-10-11',
    dayLabel: '11',
    monthLabel: 'OCTOBER',
    fullDateLabel: '11 October 2026',
    dayOfWeek: 'Sunday',
    themeTitle: 'SHUBH AARAMBH',
    motifName: 'Diya + Dandiya',
    primaryColor: '#7A1930', // Deep Maroon
    secondaryColor: '#C59B27', // Antique Gold
    accentColor: '#4A0E1C',
    bgColor: '#FAF5EE',
    badgeBg: '#F5EBE1',
  },
  '2026-10-12': {
    dayNumber: 2,
    eventDate: '2026-10-12',
    dayLabel: '12',
    monthLabel: 'OCTOBER',
    fullDateLabel: '12 October 2026',
    dayOfWeek: 'Monday',
    themeTitle: 'GARBA UTSAV',
    motifName: 'Circular Garba movement pattern',
    primaryColor: '#4A154B', // Royal Purple
    secondaryColor: '#D4AF37', // Gold
    accentColor: '#2F0830',
    bgColor: '#FAF5FC',
    badgeBg: '#F3E5F5',
  },
  '2026-10-13': {
    dayNumber: 3,
    eventDate: '2026-10-13',
    dayLabel: '13',
    monthLabel: 'OCTOBER',
    fullDateLabel: '13 October 2026',
    dayOfWeek: 'Tuesday',
    themeTitle: 'RAAS RANG',
    motifName: 'Peacock feather / elegant Gujarati pattern',
    primaryColor: '#0D5C5A', // Peacock Teal
    secondaryColor: '#D4AF37', // Gold
    accentColor: '#063A39',
    bgColor: '#F2FAF9',
    badgeBg: '#E0F2F1',
  },
  '2026-10-14': {
    dayNumber: 4,
    eventDate: '2026-10-14',
    dayLabel: '14',
    monthLabel: 'OCTOBER',
    fullDateLabel: '14 October 2026',
    dayOfWeek: 'Wednesday',
    themeTitle: 'SHAKTI',
    motifName: 'Geometric Shakti / mandala-inspired pattern',
    primaryColor: '#C84B0A', // Saffron
    secondaryColor: '#A03E0B', // Terracotta
    accentColor: '#6B2404',
    bgColor: '#FCF6F0',
    badgeBg: '#FBE9E7',
  },
  '2026-10-15': {
    dayNumber: 5,
    eventDate: '2026-10-15',
    dayLabel: '15',
    monthLabel: 'OCTOBER',
    fullDateLabel: '15 October 2026',
    dayOfWeek: 'Thursday',
    themeTitle: 'AHMEDABAD HERITAGE',
    motifName: 'Sidi Saiyyed Jali-inspired geometric pattern',
    primaryColor: '#1B2E5D', // Indigo
    secondaryColor: '#C59B27', // Antique Gold
    accentColor: '#0C1733',
    bgColor: '#F2F5FB',
    badgeBg: '#E8EAF6',
  },
  '2026-10-16': {
    dayNumber: 6,
    eventDate: '2026-10-16',
    dayLabel: '16',
    monthLabel: 'OCTOBER',
    fullDateLabel: '16 October 2026',
    dayOfWeek: 'Friday',
    themeTitle: 'RANG RAAS',
    motifName: 'Gujarati textile / Bandhani-inspired pattern',
    primaryColor: '#6A1A38', // Wine
    secondaryColor: '#9B2857', // Muted Magenta
    accentColor: '#420B20',
    bgColor: '#FAF3F6',
    badgeBg: '#FCE4EC',
  },
  '2026-10-17': {
    dayNumber: 7,
    eventDate: '2026-10-17',
    dayLabel: '17',
    monthLabel: 'OCTOBER',
    fullDateLabel: '17 October 2026',
    dayOfWeek: 'Saturday',
    themeTitle: 'UTSAV',
    motifName: 'Floral / mandala pattern',
    primaryColor: '#12573E', // Emerald
    secondaryColor: '#D4AF37', // Gold
    accentColor: '#0A3324',
    bgColor: '#F2F8F4',
    badgeBg: '#E8F5E9',
  },
  '2026-10-18': {
    dayNumber: 8,
    eventDate: '2026-10-18',
    dayLabel: '18',
    monthLabel: 'OCTOBER',
    fullDateLabel: '18 October 2026',
    dayOfWeek: 'Sunday',
    themeTitle: 'DANDIYA NIGHT',
    motifName: 'Crossed Dandiya sticks',
    primaryColor: '#0F2445', // Deep Navy
    secondaryColor: '#C59B27', // Antique Gold
    accentColor: '#061122',
    bgColor: '#F2F5FA',
    badgeBg: '#E1F5FE',
  },
  '2026-10-19': {
    dayNumber: 9,
    eventDate: '2026-10-19',
    dayLabel: '19',
    monthLabel: 'OCTOBER',
    fullDateLabel: '19 October 2026',
    dayOfWeek: 'Monday',
    themeTitle: 'GRAND FINALE',
    motifName: 'Grand mandala / celebratory radial pattern',
    primaryColor: '#540D24', // Burgundy
    secondaryColor: '#C59B27', // Antique Gold
    accentColor: '#300513',
    bgColor: '#FAF2F4',
    badgeBg: '#FFEBEE',
  },
};

export function getEventDayTheme(date: string): EventDayTheme {
  if (EVENT_DAY_THEMES[date]) {
    return EVENT_DAY_THEMES[date];
  }
  return {
    dayNumber: 1,
    eventDate: date,
    dayLabel: date.split('-')[2] || '11',
    monthLabel: 'OCTOBER',
    fullDateLabel: `${date} 2026`,
    dayOfWeek: 'Event Day',
    themeTitle: 'ONGC NAVRATRI',
    motifName: 'Traditional Navratri Motif',
    primaryColor: '#7A1930',
    secondaryColor: '#C59B27',
    accentColor: '#4A0E1C',
    bgColor: '#FAF5EE',
    badgeBg: '#F5EBE1',
  };
}

export const DEFAULT_DISPATCH_SCHEDULE: Record<string, string> = {
  '2026-10-11': '18:00',
  '2026-10-12': '17:30',
  '2026-10-13': '18:15',
  '2026-10-14': '17:45',
  '2026-10-15': '18:00',
  '2026-10-16': '18:00',
  '2026-10-17': '18:00',
  '2026-10-18': '18:00',
  '2026-10-19': '18:00',
};

export interface EmployeeDispatchSchedule {
  eventDate: string;
  dispatchTime: string;
  timezone: string;
  enabled: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastRunAt?: string | null;
  lastRunStatus?: 'SUCCESS' | 'PARTIAL_FAILURE' | 'FAILED' | 'RUNNING' | null;
  lastRunMessage?: string | null;
  lastSentCount?: number;
  lastFailedCount?: number;
}

export interface DailyEmployeePassPresentation {
  eventDate: string;
  eventDateFormatted: string;
  nightNumber: number;
  nightLabel: string;
  dayBadgeLabel: string;
  themeTitle: string;
  motifName: string;
  theme: EventDayTheme;

  attendeeName: string;
  isFamily: boolean;
  passHolderLabel: string;
  passTypeLabel: string;
  passTypeWithRelation: string;
  relation: string;

  primaryEmployeeName: string;
  employeeCpf: string;
  referenceNumber: string;
  department: string;

  ticketNumber: string;
  qrToken: string;
  status: string;

  venue: {
    name: string;
    address: string;
    gatesOpen: string;
  };
  entryTiming: string;
  organizer: string;
  eventTitle: string;
}

export interface BuildDailyPassPresentationInput {
  eventDate: string;
  ticketNumber?: string | null;
  qrToken?: string | null;
  status?: string | null;

  attendeeName?: string | null;
  isFamily?: boolean;
  relation?: string | null;

  employeeName?: string | null;
  employeeCpf?: string | null;
  referenceNumber?: string | null;
  department?: string | null;
}

export function buildDailyEmployeePassPresentation(
  input: BuildDailyPassPresentationInput,
): DailyEmployeePassPresentation {
  const theme = getEventDayTheme(input.eventDate);
  const isFamily = Boolean(
    input.isFamily ||
      (input.relation &&
        !['self', 'employee', 'primary employee', 'primary'].includes(
          input.relation.toLowerCase().trim(),
        )),
  );

  const rawRelation = input.relation?.trim() || (isFamily ? 'Family Member' : 'Self');
  const attendeeName = (
    input.attendeeName ||
    (isFamily ? 'Family Member' : input.employeeName) ||
    'Attendee'
  ).trim();
  const primaryEmployeeName = (
    input.employeeName || (!isFamily ? attendeeName : 'ONGC Employee')
  ).trim();
  const employeeCpf = (input.employeeCpf || 'N/A').trim();
  const referenceNumber = (input.referenceNumber || input.employeeCpf || 'N/A').trim();
  const department = (input.department || 'ONGC Ahmedabad').trim();

  const passHolderLabel = isFamily ? 'Family Member' : 'ONGC Employee';
  const passTypeLabel = isFamily ? 'Family Member' : 'ONGC Employee Pass';
  const passTypeWithRelation = isFamily
    ? rawRelation && rawRelation.toLowerCase() !== 'family member'
      ? `Family Member Pass (${rawRelation})`
      : 'Family Member Pass'
    : 'ONGC Employee Pass';

  return {
    eventDate: input.eventDate,
    eventDateFormatted: theme.fullDateLabel,
    nightNumber: theme.dayNumber,
    nightLabel: `NIGHT ${theme.dayNumber}`,
    dayBadgeLabel: `DAY ${theme.dayNumber} OF 9`,
    themeTitle: theme.themeTitle,
    motifName: theme.motifName,
    theme,

    attendeeName,
    isFamily,
    passHolderLabel,
    passTypeLabel,
    passTypeWithRelation,
    relation: rawRelation,

    primaryEmployeeName,
    employeeCpf,
    referenceNumber,
    department,

    ticketNumber:
      input.ticketNumber ||
      (input.qrToken ? `TK-${input.qrToken.substring(0, 10).toUpperCase()}` : 'TK-ONGC-2026'),
    qrToken: input.qrToken || '',
    status: input.status || 'ACTIVE',

    venue: {
      name: 'Malaviya Cricket Ground ONGC',
      address: 'Mahavirnagar, ONGC Colony, Chandkheda, Ahmedabad, Gujarat 382424',
      gatesOpen: '7:00 PM',
    },
    entryTiming: '7:00 PM onwards',
    organizer: 'Digant Art',
    eventTitle: 'ONGC NAVRATRI 2026',
  };
}

export interface PublicDailyPassResponseDto {
  token: string;
  ticketNumber: string;
  eventDate: string;
  attendeeName: string;
  isFamily: boolean;
  relation: string;
  employeeName: string;
  employeeCpf: string;
  referenceNumber?: string;
  department: string;
  passType: string;
  category: string;
  status: string;
  qrSvg: string;
  dayTheme: EventDayTheme;
  venue: {
    name: string;
    address: string;
    gatesOpen: string;
  };
  organizer: string;
  eventTitle: string;
  presentation?: DailyEmployeePassPresentation;
}

export interface SponsorVoucherConfig {
  enabled: boolean;
  sponsorName: string;
  voucherLabel: string;
  offerHeadline: string;
  offerSubtext: string;
  audienceLabel: string;
  instructionText: string;
  validityNote: string;
  address?: string;
  phone?: string;
  voucherImagePath?: string;
  sponsorLogoPath?: string;
  terms?: string[];
}

export const DEFAULT_SPONSOR_VOUCHER_CONFIG: SponsorVoucherConfig = {
  enabled: true,
  sponsorName: 'MAHAVIR JEWELLERS',
  voucherLabel: 'GIFT VOUCHER',
  offerHeadline: '₹5,000 OFF',
  offerSubtext: 'ON MAKING CHARGES',
  audienceLabel: 'FOR ONGC NAVRATRI 2026 PARTICIPANTS',
  instructionText: 'Show this voucher at Mahavir Jewellers to avail the offer.',
  validityNote: 'Valid: Lifetime | No expiry',
  address: '2 Amrakunj, Anne, below NY Cinemas, Tapovan Circle, Chandkheda',
  phone: '90330 56098',
  voucherImagePath: '/images/sponsors/mahavir-jewellers-voucher.jpg',
  sponsorLogoPath: '/images/sponsors/mahavir-jewellers-logo.png',
  terms: [
    'One voucher per bill.',
    'Not redeemable for cash.',
    'Not applicable on silver jewellery.',
  ],
};

export interface ScratchCardItem {
  id: string;
  title: string;
  subtitle: string;
  badgeLabel?: string;
  category: 'welcome' | 'sponsor' | 'festive';
  enabled: boolean;
  revealHeadline: string;
  revealSubheadline?: string;
  revealBody: string;
  highlightText?: string;
  validityNote?: string;
  sponsorConfig?: SponsorVoucherConfig;
  ctaText?: string;
  ctaUrl?: string;
}

export function getDefaultScratchCards(
  sponsorVoucher?: SponsorVoucherConfig | null,
): ScratchCardItem[] {
  const voucher = sponsorVoucher ?? DEFAULT_SPONSOR_VOUCHER_CONFIG;
  const isSponsorEnabled = voucher.enabled !== false;

  return [
    {
      id: 'welcome',
      title: 'YOUR NAVRATRI SURPRISE',
      subtitle: 'A little celebration awaits you',
      badgeLabel: 'NAVRATRI 2026',
      category: 'welcome',
      enabled: true,
      revealHeadline: 'FESTIVE BLESSING',
      revealSubheadline: 'Welcome to ONGC Navratri 2026',
      revealBody:
        'May the auspicious blessings of Maa Durga bring happiness, good health, and prosperous festivities to you and your entire family throughout these nine sacred nights.',
      highlightText: '9 Sacred Nights of Devotion & Joy',
      validityNote: 'Celebration Days: Oct 11 – Oct 19, 2026',
    },
    {
      id: 'mahavir',
      title: voucher.sponsorName || 'MAHAVIR JEWELLERS',
      subtitle: 'A special gift for ONGC Navratri participants',
      badgeLabel: voucher.voucherLabel || 'GIFT VOUCHER',
      category: 'sponsor',
      enabled: isSponsorEnabled,
      revealHeadline: voucher.offerHeadline || '₹5,000 OFF',
      revealSubheadline: voucher.offerSubtext || 'ON MAKING CHARGES',
      revealBody:
        'Exclusive festive jewellery voucher from our sponsor Mahavir Jewellers for ONGC Navratri participants and their families.',
      highlightText: voucher.instructionText || 'Show this voucher at Mahavir Jewellers to avail the offer.',
      validityNote: (voucher.validityNote || 'Lifetime | No expiry').replace(/^Valid:\s*/i, ''),
      sponsorConfig: voucher,
    },
    {
      id: 'garba',
      title: 'GARBA NIGHT SURPRISE',
      subtitle: 'Celebrate the spirit of Navratri',
      badgeLabel: 'EWC CELEBRATION',
      category: 'festive',
      enabled: true,
      revealHeadline: 'SPECIAL PRIVILEGE',
      revealSubheadline: 'Garba Celebration & Hospitality',
      revealBody:
        'Celebrate the vibrant spirit of Navratri with authentic Gujarati folk orchestra, devotional Maha Aarti ceremonies, and dedicated hospitality for ONGC personnel.',
      highlightText: 'Malaviya Cricket Ground, ONGC Colony',
      validityNote: 'Gates open at 7:00 PM every night',
    },
  ];
}

export interface BuildEmployeeWhatsAppMessageParams {
  employeeName: string;
  referenceNumber: string;
  passUrl: string;
  sponsorVoucher?: SponsorVoucherConfig | null;
  isTest?: boolean;
}

export function buildEmployeeWhatsAppMessage(params: BuildEmployeeWhatsAppMessageParams): string {
  const name = params.employeeName?.trim() || 'Attendee';
  const refNo = params.referenceNumber?.trim() || 'N/A';
  const passUrl = params.passUrl?.trim() || '';
  const voucher = params.sponsorVoucher;
  const isTest = params.isTest === true;

  const headerLine = `🎉 *ONGC NAVRATRI 2026* 🎉\n\n`;
  const greeting = `Hello *${name}* 👋\n\n`;
  const intro = isTest
    ? `Your ONGC Navratri E-Pass has been generated successfully as a TEST PASS. 🪔✨\n\n`
    : `Your ONGC Navratri E-Pass is ready! 🪔✨\n\n`;

  const refBlock = `🎟️ *Reference No.: ${refNo}*\n\n`;
  const safety = isTest
    ? `Your permanent QR pass is your entry credential for the event.\nPlease keep your QR safe and do not share it.\n`
    : `Your permanent QR pass is your entry credential for the event.\n\nPlease keep your QR safe and show it at the entry gate.\n`;

  let message = headerLine + greeting + intro + refBlock + safety;

  if (voucher && voucher.enabled !== false) {
    const rawValidity = (voucher.validityNote || 'Lifetime | No expiry').replace(/^Valid:\s*/i, '');
    const validityLine = isTest ? `Valid: ${rawValidity}` : `_${rawValidity}_`;

    message += `\n━━━━━━━━━━━━━━━━\n\n` +
      `💎 *A SPECIAL GIFT FOR YOU* 💎\n\n` +
      `*${voucher.sponsorName || 'MAHAVIR JEWELLERS'}*\n\n` +
      `✨ *${voucher.offerHeadline || '₹5,000 OFF'}*\n` +
      `*${voucher.offerSubtext || 'ON MAKING CHARGES'}*\n\n` +
      `${validityLine}\n`;

    if (voucher.address) {
      message += `\n📍 ${voucher.address}\n`;
    }
    if (voucher.phone) {
      message += `📞 ${voucher.phone}\n`;
    }
  }

  const isolationFooter = isTest
    ? `⚠️ This is a test registration. The generated pass is isolated from production employee records.\n\n`
    : `Please do not share your QR/e-pass with anyone.\n\n`;

  message += `\n━━━━━━━━━━━━━━━━\n\n` +
    `🎟️ *VIEW YOUR E-PASS*\n` +
    `${passUrl}\n\n` +
    isolationFooter +
    `✨ See you at ONGC Navratri 2026! ✨`;

  return message;
}

export type WhatsAppDeliveryStatus =
  | 'READY'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'TEST_RECIPIENT_NOT_CONFIGURED'
  | 'TEMPLATE_NOT_CONFIGURED';

export interface WhatsAppConfigDto {
  configured: boolean;
  isConfigured: boolean;
  provider: string;
  providerName: string;
  providerStatus: WhatsAppDeliveryStatus;
  safeRecipient: string | null;
  phoneNumberIdConfigured: boolean;
  businessAccountConfigured: boolean;
  accessTokenConfigured: boolean;
  apiVersion: string;
  testRecipientConfigured: boolean;
  templateConfigured: boolean;
  templateName: string;
  templateLanguage: string;
  passTemplateName?: string;
  passTemplateConfigured?: boolean;
  sponsorVoucher: SponsorVoucherConfig;
  voucherImageUrl: string;
  isolationMode: 'ISOLATED_TEST_MODE';
  notice: string;
}

export interface WhatsAppSendResultDto {
  success: boolean;
  status: WhatsAppDeliveryStatus;
  provider: string;
  providerMessageId?: string | null;
  safeRecipient: string | null;
  referenceNumber?: string;
  templateName?: string | null;
  templateLanguage?: string | null;
  httpStatus?: number | null;
  metaErrorCode?: number | null;
  metaErrorSubcode?: number | null;
  error?: string | null;
  messageText?: string;
  voucherImageUrl?: string;
  timestamp: string;
}

export interface WhatsAppTestSubmissionResultDto {
  referenceNumber: string;
  attendeeId: string;
  employeeId: string;
  ticketNumber: string;
  qrToken: string;
  passUrl: string;
  safeRecipient: string | null;
  messageText: string;
  voucherImageUrl: string;
  sponsorVoucher: SponsorVoucherConfig;
  providerStatus: WhatsAppDeliveryStatus;
  providerName: string;
  isConfigured: boolean;
  templateName?: string;
  templateLanguage?: string;
  passTemplateName?: string;
  passTemplateConfigured?: boolean;
}

/**
 * Authoritative string formatter for ONGC CPF numbers.
 * Guarantees CPF is always treated as a string and never parsed as a JS Number.
 * Leading zeros are strictly preserved.
 */
export function formatCpfString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return value.toLocaleString('fullwide', { useGrouping: false });
  }
  return String(value).trim();
}

/**
 * Authoritative ONGC CPF normalization rule.
 * ONGC master records contain both 5-digit and 6-digit numeric CPFs.
 * - Genuine 5-digit CPFs (e.g. "29344") remain valid 5-digit strings.
 * - Genuine 6-digit CPFs (e.g. "103506") remain valid 6-digit strings.
 * - Leading-zero CPFs (e.g. "012345") strictly preserve leading zeros as strings.
 * - Never converts to Number, never pads automatically with leading zeros.
 * - Rejects invalid formats (empty, letters, symbols, <5 or >6 digits).
 */
export function normalizeCpf(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const clean = formatCpfString(raw);
  // Matches 5 or 6 numeric digits (covers all ONGC employee master records)
  if (/^[0-9]{5,6}$/.test(clean)) {
    return clean;
  }
  return null;
}
