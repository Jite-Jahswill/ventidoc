import { generateId } from './id';
import { shops, tenantMembers, tenants, users } from './schema';
import { withSystem } from './with-system';
import { withTenant } from './with-tenant';

interface SeedTenant {
  name: string;
  slug: string;
  ownerEmail: string;
  staffEmail: string;
}

const SEED_TENANTS: SeedTenant[] = [
  {
    name: 'Lagos Fashion Co',
    slug: 'lagos-fashion-co',
    ownerEmail: 'owner@lagos-fashion-co.example',
    staffEmail: 'staff@lagos-fashion-co.example',
  },
  {
    name: 'Abuja Pharmacy Group',
    slug: 'abuja-pharmacy-group',
    ownerEmail: 'owner@abuja-pharmacy-group.example',
    staffEmail: 'staff@abuja-pharmacy-group.example',
  },
];

async function seed(): Promise<void> {
  for (const tenant of SEED_TENANTS) {
    const ownerUserId = generateId();
    const staffUserId = generateId();

    await withSystem(async (tx) => {
      await tx.insert(users).values([
        { id: ownerUserId, email: tenant.ownerEmail, name: 'Owner' },
        { id: staffUserId, email: tenant.staffEmail, name: 'Staff' },
      ]);
    });

    const tenantId = generateId();

    await withTenant(tenantId, async (tx) => {
      await tx.insert(tenants).values({
        id: tenantId,
        name: tenant.name,
        slug: tenant.slug,
        ownerUserId,
      });

      await tx.insert(shops).values([
        { tenantId, name: `${tenant.name} — Main Branch`, timezone: 'Africa/Lagos' },
        { tenantId, name: `${tenant.name} — Second Branch`, timezone: 'Africa/Lagos' },
      ]);

      await tx.insert(tenantMembers).values([
        { tenantId, userId: ownerUserId, status: 'active' },
        { tenantId, userId: staffUserId, status: 'active' },
      ]);
    });

    console.log(`Seeded tenant "${tenant.name}" (${tenantId}) with 2 shops and 2 members.`);
  }
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  await seed();
  // The app/owner connection pools (packages/db/src/client.ts) stay open
  // for reuse; this is a one-shot script, so exit explicitly instead of
  // leaving Node waiting on their idle sockets forever.
  process.exit(0);
}
