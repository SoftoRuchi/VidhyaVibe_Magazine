import { Router } from 'express';
import { getPool } from '../../db';
import { requireAdmin } from '../../middleware/admin';
import { requireAuth } from '../../middleware/auth';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/admin/users/count
 * Returns the total count of users in the system.
 */
router.get('/count', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [[result]]: any = await conn.query('SELECT COUNT(*) as count FROM users');
    res.json({ count: result.count || 0 });
  } catch (e: any) {
    console.error('Failed to fetch user count:', e);
    res.status(500).json({ error: 'fetch_count_failed' });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/admin/users
 * Returns a list of all users.
 */
router.get('/', async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [rows]: any = await conn.query(
      'SELECT id, email, name, phone, isAdmin, createdAt FROM users ORDER BY createdAt DESC',
    );

    const users = rows || [];
    const userIds = users.map((u: any) => Number(u.id)).filter((id: number) => Number.isFinite(id));

    if (userIds.length === 0) {
      return res.json([]);
    }

    const [readerRows]: any = await conn.query(
      `SELECT id, userId, name, age, className, schoolName, schoolCity, createdAt
       FROM readers
       WHERE userId IN (?) 
       ORDER BY createdAt DESC`,
      [userIds],
    );

    const readersByUserId = new Map<number, any[]>();
    for (const reader of readerRows || []) {
      const uid = Number(reader.userId);
      if (!readersByUserId.has(uid)) readersByUserId.set(uid, []);
      readersByUserId.get(uid)!.push({
        id: reader.id,
        name: reader.name,
        age: reader.age,
        className: reader.className,
        schoolName: reader.schoolName,
        schoolCity: reader.schoolCity,
        createdAt: reader.createdAt,
      });
    }

    const enrichedUsers = users.map((u: any) => {
      const children = readersByUserId.get(Number(u.id)) || [];
      return {
        ...u,
        childCount: children.length,
        children,
      };
    });

    res.json(enrichedUsers);
  } catch (e: any) {
    console.error('Failed to fetch users:', e);
    res.status(500).json({ error: 'fetch_users_failed' });
  } finally {
    conn.release();
  }
});

export default router;
