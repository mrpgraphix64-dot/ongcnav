export interface EmailAttachment {
  filename: string;
  content: string; // base64 string
  contentType?: string;
  cid?: string;
  encoding?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  displayName?: string;
  attachments?: EmailAttachment[];
}

export interface CommercialPassEmailItem {
  ticketNumber: string;
  token: string;
  category?: string;
  attendeeName?: string;
}

export interface CommercialTicketEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerMobile?: string;
  ticketType: string;
  selectedDates: string[];
  quantity: number;
  amountInr: number;
  amountPaise?: number;
  passes: CommercialPassEmailItem[];
  subject?: string;
}

export interface EmployeeDailyPassEmailData {
  recipientEmail: string;
  employeeName: string;
  attendeeName: string;
  relation: string;
  eventDate: string; // YYYY-MM-DD
  ticketNumber: string;
  qrToken: string;
  cpf?: string;
  referenceNumber?: string;
  department?: string;
  pdfBuffer?: Buffer;
  viewTicketUrl?: string;
  downloadPdfUrl?: string;
  subjectOverride?: string;
  sponsorVoucher?: import('@ongc/shared-types').SponsorVoucherConfig;
}

export interface MailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
}
