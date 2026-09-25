/**
 * Utilities and validation helpers for ONGC Employee Pass lookup (/employee/my-tickets)
 */

export function validateEmployeeLookup(
  cpf: string,
  phoneLast4: string,
): {
  isValid: boolean;
  cleanCpf: string;
  cleanPhoneLast4: string;
  error?: string;
} {
  const cleanCpf = (cpf || '').trim().toUpperCase();
  if (!cleanCpf) {
    return {
      isValid: false,
      cleanCpf: '',
      cleanPhoneLast4: '',
      error: 'Please enter your ONGC CPF number or Ticket ID',
    };
  }

  const cleanPhone = (phoneLast4 || '').trim();
  if (!cleanPhone) {
    return {
      isValid: false,
      cleanCpf,
      cleanPhoneLast4: '',
      error: 'Please enter the last 4 digits of your registered mobile number',
    };
  }

  if (!/^\d{4}$/.test(cleanPhone)) {
    return {
      isValid: false,
      cleanCpf,
      cleanPhoneLast4: cleanPhone,
      error: 'Phone verification requires exactly 4 numeric digits',
    };
  }

  return {
    isValid: true,
    cleanCpf,
    cleanPhoneLast4: cleanPhone,
  };
}

export function formatEmployeePassDates(dates?: string[] | null): string {
  if (!dates || dates.length === 0) {
    return '11–19 October 2026';
  }
  if (dates.length >= 9) {
    return 'All 9 Days (11–19 Oct 2026)';
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formatted = dates.map((d) => {
    const parts = d.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${day} ${monthNames[mIdx] || parts[1]}`;
    }
    return d;
  });
  return formatted.join(', ');
}
