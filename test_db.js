const { Client } = require('pg');

async function test(config) {
  console.log(`Testing config: user=${config.user}, password=${config.password}, db=${config.database}`);
  const client = new Client(config);
  try {
    await client.connect();
    console.log('SUCCESS!');
    await client.end();
    return true;
  } catch (err) {
    console.log('FAILED:', err.message);
    return false;
  }
}

async function run() {
  const configs = [
    { user: 'postgres', password: 'postgres', host: 'localhost', port: 5432, database: 'postgres' },
    { user: 'postgres', password: '', host: 'localhost', port: 5432, database: 'postgres' },
    { user: 'usuario1', password: '', host: 'localhost', port: 5432, database: 'postgres' },
    { user: 'usuario1', password: 'password', host: 'localhost', port: 5432, database: 'postgres' },
    { user: 'usuario1', password: 'usuario1', host: 'localhost', port: 5432, database: 'postgres' },
  ];

  for (const config of configs) {
    if (await test(config)) {
      console.log('Found working config!');
      console.log(JSON.stringify(config, null, 2));
      process.exit(0);
    }
  }
  console.log('All attempts failed.');
  process.exit(1);
}

run();
