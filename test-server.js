const express = require('express');
const app = express();
const PORT = process.env.PORT || 5001;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Test server running' });
});

app.get('/', (req, res) => {
  res.json({ message: 'PREP101 Test Server', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 PORT: ${process.env.PORT || 'not set'}`);
  console.log(`🗄️  DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'MISSING'}`);
  console.log(`🔐 JWT_SECRET: ${process.env.JWT_SECRET ? 'SET' : 'MISSING'}`);
  console.log(`🤖 ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'SET' : 'MISSING'}`);
});
