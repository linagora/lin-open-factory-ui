/**
 * Fake of the LinID API for the E2E environment: it answers an empty object to any request, the frontend without any
 * module only needing its calls to succeed (user preferences, backend translations).
 */
import { createServer } from 'node:http';

createServer((request, response) => {
  console.log(`${request.method} ${request.url}`);
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end('{}');
}).listen(3000, '0.0.0.0');
