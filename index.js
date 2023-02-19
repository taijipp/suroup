const express = require('express');
const { createProxyMiddleware:proxy } = require('http-proxy-middleware');
require('dotenv').config();
const { port } = process.env;

const app = express();
app.use(proxy({
	router: {
		'/oauth': 'http://127.0.0.1:7000',
		'/': 'http://127.0.0.1:3000',
	},
	changeOrigin: true,
}));
app.listen( port||30100 );


