/**
 * Fake of the LinID API for the E2E environment: it answers an empty object to any request, the frontend without any
 * module only needing its calls to succeed (user preferences, backend translations).
 */
import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.all('*', async () => ({}));

await app.listen({ host: '0.0.0.0', port: 3000 });
