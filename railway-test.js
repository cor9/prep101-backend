const express = require('express');
const app = express();
const PORT = process.env.PORT || 5001;

// Log environment variables (without sensitive data)
console.log('🚀 Railway Test Server Starting...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('🔧 PORT:', process.env.PORT || 'not set');
console.log('🗄️  DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'MISSING');
console.log('🔐 JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'MISSING');
console.log('🤖 ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'SET' : 'MISSING');

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Railway test server running',
    timestamp: new Date().toISOString(),
    env: {
      port: process.env.PORT,
      nodeEnv: process.env.NODE_ENV,
      hasDatabase: !!process.env.DATABASE_URL,
      hasJwt: !!process.env.JWT_SECRET,
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY
    }
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'PREP101 Railway Test Server',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Railway test server running on port ${PORT}`);
  console.log(`🌐 Server bound to 0.0.0.0:${PORT}`);
});
