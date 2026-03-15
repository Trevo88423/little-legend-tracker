import dotenv from 'dotenv'
dotenv.config({ path: '.env' })

import pg from 'pg'
import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const { Client } = pg

const CONNECTION_STRING = process.env.DATABASE_URL
if (!CONNECTION_STRING) {
  console.error('DATABASE_URL not set in .env')
  process.exit(1)
}

async function runMigrations() {
  const client = new Client({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  })

  try {
    console.log('Connecting to database...')
    await client.connect()
    console.log('Connected!\n')

    // Get all migration files sorted by name
    const migrationsDir = join(__dirname, '..', 'database')
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    console.log(`Found ${files.length} migration files:\n`)

    for (const file of files) {
      const filePath = join(migrationsDir, file)
      const sql = readFileSync(filePath, 'utf8')

      console.log(`  Running ${file}...`)
      try {
        await client.query(sql)
        console.log(`  Done\n`)
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`  Already applied, skipping\n`)
        } else {
          console.error(`  FAILED: ${err.message}\n`)
          throw err
        }
      }
    }

    console.log('All migrations applied successfully!')

  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
    console.log('Disconnected')
  }
}

runMigrations()
