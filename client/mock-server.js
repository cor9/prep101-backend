const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Mock successful registration
app.post('/api/auth/register', (req, res) => {
  console.log('Registration:', req.body);
  res.json({
    message: 'Registration successful',
    token: 'mock-token-123',
    user: {
      id: '1',
      name: req.body.name,
      email: req.body.email,
      subscription: 'free',
      guidesUsed: 0,
      guidesLimit: 3
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  res.json({
    message: 'Login successful',
    token: 'mock-token-123',
    user: {
      id: '1',
      name: 'Test User',
      email: req.body.email,
      subscription: 'free',
      guidesUsed: 0,
      guidesLimit: 3
    }
  });
});

app.get('/api/guides/my-guides', (req, res) => {
  res.json([]);
});

app.listen(5001, () => console.log('Mock server running on 5001'));
