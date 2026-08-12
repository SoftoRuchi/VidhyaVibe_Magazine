import type { PoolConnection } from 'mysql2/promise';

async function ensureWallet(conn: PoolConnection, userId: number): Promise<void> {
  await conn.query(
    `INSERT IGNORE INTO learn_wallets (user_id, balance, updated_at) VALUES (?, 0, NOW(3))`,
    [userId],
  );
}

export async function getLearnWalletBalance(conn: PoolConnection, userId: number): Promise<number> {
  await ensureWallet(conn, userId);
  const [rows]: any = await conn.query(
    `SELECT balance FROM learn_wallets WHERE user_id = ? LIMIT 1`,
    [userId],
  );
  return Number(rows?.[0]?.balance ?? 0);
}

/**
 * Apply a signed wallet change and write a ledger row.
 * amount > 0 credit, amount < 0 debit. Throws if debit would go negative.
 */
export async function applyLearnWalletChange(
  conn: PoolConnection,
  input: {
    userId: number;
    amount: number;
    entryType: string;
    activityId?: number | null;
    note?: string | null;
  },
): Promise<{ balance: number }> {
  const amount = Math.trunc(Number(input.amount) || 0);
  if (!amount) {
    const balance = await getLearnWalletBalance(conn, input.userId);
    return { balance };
  }

  await ensureWallet(conn, input.userId);

  if (amount < 0) {
    const [upd]: any = await conn.query(
      `UPDATE learn_wallets
       SET balance = balance + ?, updated_at = NOW(3)
       WHERE user_id = ? AND balance >= ?`,
      [amount, input.userId, Math.abs(amount)],
    );
    if (!upd?.affectedRows) {
      const err: any = new Error('insufficient_wallet_balance');
      err.code = 'insufficient_wallet_balance';
      throw err;
    }
  } else {
    await conn.query(
      `UPDATE learn_wallets
       SET balance = balance + ?, updated_at = NOW(3)
       WHERE user_id = ?`,
      [amount, input.userId],
    );
  }

  const balance = await getLearnWalletBalance(conn, input.userId);
  await conn.query(
    `INSERT INTO learn_wallet_ledger
      (user_id, amount, balance_after, entry_type, activity_id, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
    [input.userId, amount, balance, input.entryType, input.activityId ?? null, input.note ?? null],
  );
  return { balance };
}

/** Credit points once per completed activity (idempotent via ledger check). */
export async function creditLearnActivityPoints(
  conn: PoolConnection,
  input: { userId: number; activityId: number; points: number; title?: string },
): Promise<{ balance: number; credited: number }> {
  const points = Math.max(0, Math.trunc(Number(input.points) || 0));
  if (!points) {
    return { balance: await getLearnWalletBalance(conn, input.userId), credited: 0 };
  }

  const [existing]: any = await conn.query(
    `SELECT id FROM learn_wallet_ledger
     WHERE user_id = ? AND activity_id = ? AND entry_type = 'ACTIVITY_EARN'
     LIMIT 1`,
    [input.userId, input.activityId],
  );
  if (existing?.[0]) {
    return { balance: await getLearnWalletBalance(conn, input.userId), credited: 0 };
  }

  const { balance } = await applyLearnWalletChange(conn, {
    userId: input.userId,
    amount: points,
    entryType: 'ACTIVITY_EARN',
    activityId: input.activityId,
    note: input.title ? `Earned from ${input.title}` : 'Activity reward',
  });
  return { balance, credited: points };
}
