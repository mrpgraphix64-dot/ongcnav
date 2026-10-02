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

export enum CommercialOrderSource {
  PUBLIC = 'PUBLIC',
  AGENT = 'AGENT',
}

export enum CommercialPaymentMode {
  RAZORPAY = 'RAZORPAY',
  OFFLINE = 'OFFLINE',
  ONLINE = 'RAZORPAY',
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
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  CHECKED_IN = 'CHECKED_IN',
  CANCELLED = 'CANCELLED',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
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
  ACTIVE = 'ACTIVE',
  SUCCESS = 'SUCCESS',
  VOIDED = 'VOIDED',
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

/**
 * Authoritative evaluation of SUPER_ADMIN Full Power mode.
 *
 * STRICT PRODUCTION FAILSAFE:
 * If NODE_ENV is 'production' (or undefined/empty), Full Power is NEVER active under any circumstances.
 * Only allowed when NODE_ENV is explicitly non-production (staging, development, test, local),
 * AND the authenticated user's role is SUPER_ADMIN,
 * AND the persistent setting is explicitly enabled in the database.
 */
export function isSuperAdminFullPowerActive(
  userRole?: string | null,
  isSettingEnabled?: boolean | string | null,
  nodeEnv?: string | null,
): boolean {
  // 1. Strict production fail-closed check
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

  // 2. Role check: only SUPER_ADMIN can wield Full Power
  const role = (userRole || '').toUpperCase().trim();
  if (role !== UserRole.SUPER_ADMIN) {
    return false;
  }

  // 3. Setting value check
  if (typeof isSettingEnabled === 'boolean') {
    return isSettingEnabled;
  }
  const flag = String(isSettingEnabled || '').toLowerCase().trim();
  return flag === 'true' || flag === '1';
}

/**
 * Checks whether global maintenance mode is enabled.
 */
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

export * from './admin-page-access';
