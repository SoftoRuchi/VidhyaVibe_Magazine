import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Check if data already exists
  const existingMagazines = await prisma.magazine.count();
  if (existingMagazines > 0) {
    console.log('⚠️  Database already has data. Skipping seed.');
    console.log('To reseed, manually clear the database first.');
    return;
  }

  // Create Subscription Plans
  console.log('Creating subscription plans...');
  const monthlyPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Monthly Subscription',
      slug: 'monthly',
      description: 'Get a new magazine every month',
      priceCents: 9900, // ₹99.00
      currency: 'INR',
      minMonths: 1,
      deliveryMode: 'BOTH',
      active: true,
    },
  });

  const yearlyPlan = await prisma.subscriptionPlan.create({
    data: {
      name: 'Yearly Subscription',
      slug: 'yearly',
      description: 'Save 20% with annual subscription',
      priceCents: 95000, // ₹950.00
      currency: 'INR',
      minMonths: 12,
      deliveryMode: 'BOTH',
      active: true,
    },
  });

  // Create Magazines
  console.log('Creating magazines...');
  const magazines = await Promise.all([
    prisma.magazine.create({
      data: {
        title: 'Space Explorers',
        slug: 'space-explorers',
        publisher: 'VidhyaVibe Magazine Publishing',
        description:
          'Journey to the stars and discover the wonders of space, planets, and galaxies.',
        category: '8-11',
        active: true,
      },
    }),
    prisma.magazine.create({
      data: {
        title: 'Deep Ocean Mysteries',
        slug: 'deep-ocean-mysteries',
        publisher: 'VidhyaVibe Magazine Publishing',
        description:
          'Dive deep into the ocean and explore amazing sea creatures and underwater worlds.',
        category: '8-11',
        active: true,
      },
    }),
    prisma.magazine.create({
      data: {
        title: 'Ancient Civilizations',
        slug: 'ancient-civilizations',
        publisher: 'VidhyaVibe Magazine Publishing',
        description: 'Travel back in time to discover pyramids, pharaohs, and ancient cultures.',
        category: '12-14',
        active: true,
      },
    }),
    prisma.magazine.create({
      data: {
        title: 'Tech Innovators',
        slug: 'tech-innovators',
        publisher: 'VidhyaVibe Magazine Publishing',
        description:
          'Explore cutting-edge technology, coding, robotics, and the future of innovation.',
        category: '15-16',
        active: true,
      },
    }),
    prisma.magazine.create({
      data: {
        title: 'World Leaders & History',
        slug: 'world-leaders-history',
        publisher: 'VidhyaVibe Magazine Publishing',
        description: 'Learn about influential leaders, historical events, and global politics.',
        category: '17-18',
        active: true,
      },
    }),
    prisma.magazine.create({
      data: {
        title: 'Wild Safari',
        slug: 'wild-safari',
        publisher: 'VidhyaVibe Magazine Publishing',
        description:
          'Meet the kings of the jungle and discover amazing wildlife from around the world.',
        category: '8-11',
        active: true,
      },
    }),
    prisma.magazine.create({
      data: {
        title: 'Science Lab',
        slug: 'science-lab',
        publisher: 'VidhyaVibe Magazine Publishing',
        description:
          'Conduct experiments, learn about chemistry, physics, and the scientific method.',
        category: '12-14',
        active: true,
      },
    }),
  ]);

  // Create Magazine Editions
  console.log('Creating magazine editions...');
  const editions = [];
  for (let i = 0; i < magazines.length; i++) {
    const mag = magazines[i];
    // Create 2 editions per magazine
    for (let j = 1; j <= 2; j++) {
      const edition = await prisma.magazineEdition.create({
        data: {
          magazineId: mag.id,
          volume: 1,
          issueNumber: j,
          sku: `${mag.slug}-v1-i${j}`,
          publishedAt: new Date(2023, 10 - j, 1), // Oct, Sept
          pages: 32,
        },
      });
      editions.push(edition);
    }
  }

  // Create Users with Guardians
  console.log('Creating users...');
  const users = [];

  // Ensure user_auth table exists
  await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS user_auth (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNIQUE,
        password_hash VARCHAR(255),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

  const passwordHash = await bcrypt.hash('password123', 10);

  for (let i = 1; i <= 25; i++) {
    // Create guardian first
    const guardian = await prisma.guardian.create({
      data: {
        name: `Parent ${i}`,
        phone: `555-${String(i).padStart(4, '0')}`,
        relation: i % 2 === 0 ? 'Mother' : 'Father',
        user: {
          create: {
            email: `user${i}@example.com`,
            name: `User ${i}`,
            phone: `555-${String(i + 1000).padStart(4, '0')}`,
            isAdmin: i === 1, // First user is admin
          },
        },
      },
      include: {
        user: true,
      },
    });

    // Update user to set primaryGuardianId
    const user = await prisma.user.update({
      where: { id: guardian.user.id },
      data: { primaryGuardianId: guardian.id },
    });

    users.push(user);

    // Create password record
    await prisma.$executeRaw`
            INSERT INTO user_auth (user_id, password_hash) VALUES (${user.id}, ${passwordHash})
        `;

    // Create 1-2 readers per user
    const readerCount = i % 3 === 0 ? 2 : 1;
    for (let r = 1; r <= readerCount; r++) {
      await prisma.reader.create({
        data: {
          userId: user.id,
          name: `Child ${i}-${r}`,
          dob: new Date(2010 + (i % 10), i % 12, 1),
          age: 8 + (i % 10),
          className: `Grade ${3 + (i % 8)}`,
          schoolName: `School ${(i % 5) + 1}`,
          schoolCity: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][i % 5],
          deliveryMode: i % 2 === 0 ? 'ELECTRONIC' : 'PHYSICAL',
        },
      });
    }
  }

  // Create Subscriptions
  console.log('Creating subscriptions...');
  const readers = await prisma.reader.findMany();

  for (let i = 0; i < Math.min(readers.length, 40); i++) {
    const reader = readers[i];
    const magazine = magazines[i % magazines.length];
    const plan = i % 3 === 0 ? yearlyPlan : monthlyPlan;

    await prisma.userSubscription.create({
      data: {
        userId: reader.userId,
        readerId: reader.id,
        magazineId: magazine.id,
        planId: plan.id,
        status: ['ACTIVE', 'ACTIVE', 'ACTIVE', 'CANCELLED'][i % 4], // 75% active
        startsAt: new Date(2023, 0, 1),
        endsAt: new Date(2024, 11, 31),
        autoRenew: i % 3 !== 0,
        priceCents: plan.priceCents,
        currency: 'INR',
      },
    });
  }

  // Create Payments
  console.log('Creating payments...');
  const subscriptions = await prisma.userSubscription.findMany();

  for (let i = 0; i < Math.min(subscriptions.length, 30); i++) {
    const sub = subscriptions[i];
    await prisma.payment.create({
      data: {
        userId: sub.userId,
        subscriptionId: sub.id,
        amountCents: sub.priceCents,
        currency: 'INR',
        provider: 'stripe',
        providerPaymentId: `pi_${Math.random().toString(36).substring(7)}`,
        status: ['SUCCESS', 'SUCCESS', 'SUCCESS', 'PENDING'][i % 4], // 75% success
      },
    });
  }

  console.log('✅ Database seeded successfully!');
  console.log(`Created:
  - ${magazines.length} magazines
  - ${editions.length} magazine editions
  - ${users.length} users
  - ${readers.length} readers
  - ${subscriptions.length} subscriptions
  - ${Math.min(subscriptions.length, 30)} payments
  `);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
