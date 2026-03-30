import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Event } from './event.entity';
import { Store } from '../auth/store.entity';

/**
 * Standalone seed script — run with: npm run seed
 *
 * Creates 2 demo stores and 50,000 events per store (100k total).
 * Uses bulk INSERT in batches of 1,000 for performance.
 */

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/amboras';

const dataSource = new DataSource({
  type: 'postgres',
  url: DATABASE_URL,
  entities: [Event, Store],
  synchronize: true,
});

/* ---------- Config ---------- */

const STORES = [
  {
    id: 'store_001',
    name: 'TechGadgets',
    email: 'demo@techgadgets.com',
    password: 'demo1234',
  },
  {
    id: 'store_002',
    name: 'FashionHub',
    email: 'demo@fashionhub.com',
    password: 'demo1234',
  },
];

const EVENT_TYPES = [
  { type: 'page_view', weight: 60 },
  { type: 'add_to_cart', weight: 20 },
  { type: 'remove_from_cart', weight: 5 },
  { type: 'checkout_started', weight: 8 },
  { type: 'purchase', weight: 7 },
];

const TOTAL_WEIGHT = EVENT_TYPES.reduce((s, e) => s + e.weight, 0);
const EVENTS_PER_STORE = 50_000;
const BATCH_SIZE = 1000;
const NUM_PRODUCTS = 20;
const DAYS_BACK = 90;

/* ---------- Helpers ---------- */

function pickEventType(): string {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const et of EVENT_TYPES) {
    r -= et.weight;
    if (r <= 0) return et.type;
  }
  return 'page_view';
}

function randomTimestamp(): Date {
  const now = Date.now();
  const daysAgo = Math.floor(Math.random() * DAYS_BACK);
  const dayStart = now - daysAgo * 24 * 60 * 60 * 1000;

  // Realistic daily pattern: more traffic between 9am-9pm
  let hour: number;
  if (Math.random() < 0.75) {
    hour = 9 + Math.floor(Math.random() * 12); // 9am–9pm (75% of traffic)
  } else {
    hour = Math.random() < 0.5
      ? Math.floor(Math.random() * 9)           // 12am–9am
      : 21 + Math.floor(Math.random() * 3);     // 9pm–12am
  }

  const minute = Math.floor(Math.random() * 60);
  const second = Math.floor(Math.random() * 60);
  const date = new Date(dayStart);
  date.setHours(hour, minute, second, Math.floor(Math.random() * 1000));
  return date;
}

function randomAmount(): number {
  // Log-normal-ish distribution: most $10-$50, some up to $300
  const base = 9.99 + Math.random() * 40;
  const multiplier = Math.random() < 0.15 ? 2 + Math.random() * 5 : 1;
  return Math.min(299.99, parseFloat((base * multiplier).toFixed(2)));
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ---------- Main ---------- */

async function seed() {
  console.log(' Starting seed...');
  console.log(` Database: ${DATABASE_URL}`);

  await dataSource.initialize();
  console.log(' Database connected');

  // Clean existing data
  await dataSource.query('DELETE FROM events');
  await dataSource.query('DELETE FROM stores');
  console.log(' Cleaned existing data');

  // Seed stores
  for (const s of STORES) {
    const hash = await bcrypt.hash(s.password, 10);
    await dataSource.query(
      `INSERT INTO stores (id, name, owner_email, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [s.id, s.name, s.email, hash],
    );
    console.log(` Store created: ${s.name} (${s.email})`);
  }

  // Seed events per store
  for (const store of STORES) {
    console.log(`\n Seeding ${EVENTS_PER_STORE.toLocaleString()} events for ${store.name}...`);

    let inserted = 0;
    while (inserted < EVENTS_PER_STORE) {
      const batchEnd = Math.min(inserted + BATCH_SIZE, EVENTS_PER_STORE);
      const batchCount = batchEnd - inserted;

      const values: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      for (let i = 0; i < batchCount; i++) {
        const eventType = pickEventType();
        const productId = `prod_${String(Math.floor(Math.random() * NUM_PRODUCTS) + 1).padStart(3, '0')}`;
        const eventId = generateUUID();
        const timestamp = randomTimestamp();

        const hasAmount = eventType === 'purchase' || eventType === 'checkout_started';
        const amount = hasAmount ? randomAmount() : null;

        values.push(
          `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5})`,
        );
        params.push(eventId, store.id, eventType, timestamp.toISOString(), productId, amount);
        paramIdx += 6;
      }

      await dataSource.query(
        `INSERT INTO events (event_id, store_id, event_type, timestamp, product_id, amount)
         VALUES ${values.join(', ')}`,
        params,
      );

      inserted = batchEnd;
      if (inserted % 10000 === 0 || inserted === EVENTS_PER_STORE) {
        console.log(`   ${inserted.toLocaleString()} / ${EVENTS_PER_STORE.toLocaleString()}`);
      }
    }

    console.log(` ${store.name}: ${EVENTS_PER_STORE.toLocaleString()} events seeded`);
  }

  // Create additional indexes that TypeORM synchronize may not create
  try {
    await dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_events_store_product
       ON events(store_id, product_id) WHERE product_id IS NOT NULL`,
    );
    console.log(' Partial index created');
  } catch {
    console.log(' Partial index already exists');
  }

  console.log('\n Seed complete!');
  console.log(`   Total events: ${(EVENTS_PER_STORE * STORES.length).toLocaleString()}`);
  console.log('   Demo logins:');
  for (const s of STORES) {
    console.log(`     ${s.email} / ${s.password}`);
  }

  await dataSource.destroy();
  process.exit(0);
}

seed().catch((err) => {
  console.error(' Seed failed:', err);
  process.exit(1);
});
