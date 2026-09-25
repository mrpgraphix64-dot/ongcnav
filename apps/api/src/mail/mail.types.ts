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
  ticketType: string;
  selectedDates: string[];
  quantity: number;
  amountInr: number;
  passes: CommercialPassEmailItem[];
}

export interface MailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
}
