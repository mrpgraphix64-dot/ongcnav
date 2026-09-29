/**
 * Canonical Asia/Kolkata (IST, UTC+05:30) date helper.
 * Returns date in YYYY-MM-DD format.
 */
export function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Resolves the active operational event date across all services:
 * 1. Checks override setting 'event_control.active_event_date' (modern Admin Event Control key)
 * 2. Checks legacy setting 'active_event_date' (historical / migration key)
 * 3. Falls back to current date in Asia/Kolkata (IST)
 */
export async function resolveActiveEventDate(prisma: {
  setting: {
    findFirst?: (args: any) => Promise<{ key: string; value: string } | null>;
    findUnique?: (args: any) => Promise<{ key: string; value: string } | null>;
  };
}): Promise<string> {
  if (prisma.setting.findFirst) {
    const modern = await prisma.setting.findFirst({
      where: { key: 'event_control.active_event_date' },
    });
    if (modern?.value && modern.value.trim() !== '') {
      return modern.value.trim();
    }

    const legacy = await prisma.setting.findFirst({
      where: { key: 'active_event_date' },
    });
    if (legacy?.value && legacy.value.trim() !== '') {
      return legacy.value.trim();
    }
  } else if (prisma.setting.findUnique) {
    const modern = await prisma.setting.findUnique({
      where: { key: 'event_control.active_event_date' },
    });
    if (modern?.value && modern.value.trim() !== '') {
      return modern.value.trim();
    }

    const legacy = await prisma.setting.findUnique({
      where: { key: 'active_event_date' },
    });
    if (legacy?.value && legacy.value.trim() !== '') {
      return legacy.value.trim();
    }
  }

  return getTodayIST();
}
