const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false } 
    }
  : {
      user: 'postgres',
      host: 'localhost',
      database: 'postgres',
      password: 'postgres',
      port: 5432,
    };

const pool = new Pool(poolConfig);

async function init() {
  try {
    // Check if database exists, if not create it
    // Note: In a real scenario, we might want to create a specific database 'lobby_db'
    // For simplicity, we'll use the default 'postgres' database or check if we can create one.
    // However, creating a DB from within a connection to another DB can be tricky with connection pooling.
    // We will stick to using the default 'postgres' database for this prototype or assume it exists.
    
    console.log('Creating table if not exists...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blocks (
        id SERIAL PRIMARY KEY,
        x FLOAT NOT NULL,
        y FLOAT NOT NULL,
        z FLOAT NOT NULL,
        type INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Table "blocks" is ready.');
    process.exit(0);
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
}

init();
