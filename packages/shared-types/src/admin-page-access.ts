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
