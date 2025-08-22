const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

app.use('/api', createProxyMiddleware({
  target: 'http://localhost:5001',
  changeOrigin: true
}));

app.listen(3002, () => console.log('Proxy running on 3002'));
