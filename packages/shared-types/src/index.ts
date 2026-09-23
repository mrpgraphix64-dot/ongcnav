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
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
  CHECKED_IN = 'CHECKED_IN',
  CANCELLED = 'CANCELLED',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
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

export enum LoadTestScenario {
  NORMAL = 'NORMAL',
  DUPLICATE = 'DUPLICATE',
  INVALID = 'INVALID_QR',
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
