// AWS Lambda entry point. Wraps the existing Express app with serverless-http
// so it can run inside Lambda + Function URL with no logic changes. Local dev
// (`npm start`) continues to use server.js's app.listen path.
const serverless = require('serverless-http');
const app = require('./server');

exports.handler = serverless(app, {
    binary: false
});
