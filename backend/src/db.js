import mysql from 'mysql2/promise'
import { config } from './config.js'

export const pool = mysql.createPool({
  ...config.db,
  connectionLimit: 10,
  namedPlaceholders: false,
  decimalNumbers: true,
  dateStrings: false,
})

// Run fn(conn) inside a transaction; commits on success, rolls back on any error.
export async function withTransaction(fn) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function one(sql, params = [], conn = pool) {
  const [rows] = await conn.query(sql, params)
  return rows[0] || null
}

export async function all(sql, params = [], conn = pool) {
  const [rows] = await conn.query(sql, params)
  return rows
}
