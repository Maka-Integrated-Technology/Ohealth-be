// Deployment-level smoke test: use the built worker against PostgreSQL while
// replacing only the external SMTP boundary. No real email leaves the test.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const nodemailer = require('nodemailer');

let rendered;
nodemailer.createTransport = () => ({
  sendMail: async (message) => {
    rendered = message.html;
    return { messageId: 'oauth-notification-runtime-smoke' };
  },
});

const { initializeDataSource } = require('../../dist/database/data-source');
const { run } = require('../../dist/workers/oauth-security-notifications');

async function main() {
  const email = `oauth-runtime-${randomUUID()}@example.invalid`;
  let userId;
  let eventId;
  let dataSource = await initializeDataSource();
  try {
    const users = await dataSource.query(
      'INSERT INTO users ' +
        '(email, password, first_name, last_name, role, is_active, is_verified, account_status, email_verified_at, password_authentication_enabled) ' +
        "VALUES ($1, 'runtime-smoke-disabled', 'Runtime', 'Smoke', 'PATIENT', true, true, 'active', now(), false) " +
        'RETURNING id',
      [email],
    );
    userId = users[0].id;
    const events = await dataSource.query(
      'INSERT INTO outbox_events ' +
        '(aggregate_type, aggregate_id, event_type, payload) ' +
        "VALUES ('user', $1, 'oauth_google_unlinked', $2::jsonb) RETURNING id",
      [userId, JSON.stringify({ user_id: userId })],
    );
    eventId = events[0].id;
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }

  try {
    await run(['--batch-size=1']);
    dataSource = await initializeDataSource();
    const events = await dataSource.query(
      'SELECT status, processed_at FROM outbox_events WHERE id = $1',
      [eventId],
    );
    assert.equal(events[0]?.status, 'published');
    assert.ok(events[0]?.processed_at);
    assert.match(rendered, /Google sign-in method was removed/);
    assert.doesNotMatch(rendered, /token|nonce|\{\{|\{%/i);
  } finally {
    if (!dataSource.isInitialized) await dataSource.initialize();
    if (eventId) {
      await dataSource.query('DELETE FROM outbox_events WHERE id = $1', [
        eventId,
      ]);
    }
    if (userId) {
      await dataSource.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    if (dataSource.isInitialized) await dataSource.destroy();
  }
  process.stdout.write(
    'Deployed OAuth security notification runtime dispatched a queued event.\n',
  );
}

main().catch(() => {
  process.stderr.write(
    'OAuth security notification runtime smoke test failed.\n',
  );
  process.exitCode = 1;
});
