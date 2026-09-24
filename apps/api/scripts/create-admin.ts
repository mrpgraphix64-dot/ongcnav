// One-time STAGING/local bootstrap utility — creates or promotes a
// SUPER_ADMIN user directly in the database.
//
// This exists because there is no other safe way to create the FIRST admin
// on a fresh database: POST /admin/staff (staff.controller.ts) already
// requires an authenticated SUPER_ADMIN/EVENT_ADMIN to call it, and the
// ADMIN_EMAIL/ADMIN_PASSWORD emergency login fallback (auth.service.ts)
// issues a JWT with sub: '0', which JwtStrategy can never resolve to a real
// User row (id is a BigInt autoincrement starting at 1) — so that fallback
// authenticates the login call itself but cannot use any guarded route
// afterward. This script inserts a real, working User row instead, using
// the exact same bcrypt convention (10 salt rounds) as staff.service.ts.
//
// Not part of the application at runtime and not wired into any NestJS
// module — it only uses PrismaClient directly. apps/api/tsconfig.json
// explicitly excludes "scripts" from compilation, so `nest build` never
// emits this into dist/ or ships it as part of the normal build/start
// pipeline.
//
// Usage (run manually, once, wherever the target DATABASE_URL is already
// configured in the environment — e.g. from within apps/api/ on staging,
// where apps/api/.env is picked up normally):
//
//   ADMIN_NAME="Jane Doe" \
//   ADMIN_EMAIL="jane@example.com" \
//   ADMIN_PASSWORD="<a strong password of your own choosing>" \
//   npx ts-node scripts/create-admin.ts
//
// Do not hardcode real values into this file, do not commit a version of
// it with credentials filled in, and do not log the password anywhere.

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_SALT_ROUNDS = 10; // matches staff.service.ts

async function generateUniqueStaffId(prisma: PrismaClient): Promise<string> {
  // Mirrors staff.service.ts's own STF-### allocation so admin users created
  // by this script look and behave exactly like ones created through the
  // normal staff-management endpoint, with no risk of colliding with an
  // existing staffId.
  let count = (await prisma.user.count()) + 1;
  let staffId = `STF-${String(count).padStart(3, '0')}`;
  while (await prisma.user.findUnique({ where: { staffId } })) {
    count++;
    staffId = `STF-${String(count).padStart(3, '0')}`;
  }
  return staffId;
}

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      'Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD environment variables before running this script.',
    );
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters long.');
  }

  const prisma = new PrismaClient();

  try {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
      create: {
        name,
        email,
        staffId: existing?.staffId ?? (await generateUniqueStaffId(prisma)),
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });

    // Never log the password — only non-sensitive identifiers.
    console.log(
      `SUPER_ADMIN ready: id=${user.id.toString()} staffId=${user.staffId} email=${user.email}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
