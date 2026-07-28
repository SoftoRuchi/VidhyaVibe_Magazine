import { prisma } from '@magazine/db';
import { validateCoupon } from '../coupons';

jest.mock('@magazine/db', () => {
  return {
    prisma: {
      coupon: {
        findUnique: jest.fn(),
      },
      couponUsage: {
        count: jest.fn(),
        create: jest.fn(),
      },
    },
  };
});

describe('coupons service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('valid coupon returns valid true', async () => {
    (prisma.coupon.findUnique as any).mockResolvedValue({
      id: 1,
      code: 'TEST',
      active: true,
      discountPct: 10,
    });
    (prisma.couponUsage.count as any).mockResolvedValue(0);
    const res = await validateCoupon('TEST', 2, undefined, undefined);
    expect(res.valid).toBe(true);
    expect(res.coupon.id).toBe(1);
    expect(res.discountPct).toBe(10);
  });

  test('expired coupon returns expired', async () => {
    (prisma.coupon.findUnique as any).mockResolvedValue({
      id: 2,
      code: 'OLD',
      active: true,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const res = await validateCoupon('OLD');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('expired');
  });

  test('empty code returns not_found', async () => {
    const res = await validateCoupon('   ');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('not_found');
  });
});
