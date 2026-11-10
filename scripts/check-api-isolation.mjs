import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const BASE_URL = process.env.API_TEST_URL ?? 'http://localhost:3000';
const ENDPOINT = process.env.DYNAMODB_ENDPOINT;
const TABLE = process.env.DYNAMODB_TABLE_NAME ?? 'tidewell-store';
const REGION = process.env.AWS_REGION ?? 'eu-central-1';

function assertLoopback(value, label) {
  if (!value) throw new Error(`${label} must be set explicitly`);
  const url = new URL(value);
  assert.equal(url.protocol, 'http:', `${label} must use HTTP for this local test`);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
    `${label} must point to localhost, not a live service`);
}
assertLoopback(BASE_URL, 'API_TEST_URL');
assertLoopback(ENDPOINT, 'DYNAMODB_ENDPOINT');
if (!/^[a-zA-Z0-9_.-]+$/.test(TABLE)) throw new Error('Invalid DynamoDB table name');

const db = DynamoDBDocumentClient.from(new DynamoDBClient({
  endpoint: ENDPOINT,
  region: REGION,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  maxAttempts: 2,
}), { marshallOptions: { removeUndefinedValues: true } });

class BrowserSession {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
  }

  async request(method, path, { json, form, origin = BASE_URL } = {}) {
    const headers = { Accept: 'application/json' };
    if (this.cookies.size) {
      headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    let body;
    if (json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    } else if (form !== undefined) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form).toString();
    }
    if (method !== 'GET' && origin) headers.Origin = origin;

    const response = await fetch(new URL(path, BASE_URL), {
      method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(15000),
    });
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const text of setCookies) {
      const pair = text.split(';', 1)[0];
      const idx = pair.indexOf('=');
      if (idx > 0) this.cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    return { status: response.status, data, headers: response.headers };
  }

  async get(path) { return this.request('GET', path); }
  async post(path, json, origin) { return this.request('POST', path, { json, origin }); }

  async login(email, password) {
    const csrf = await this.get('/api/auth/csrf');
    assert.equal(csrf.status, 200, `${this.label}: could not obtain CSRF token`);
    assert.ok(csrf.data?.csrfToken, `${this.label}: missing CSRF token`);
    const result = await this.request('POST', '/api/auth/callback/credentials', {
      form: {
        csrfToken: csrf.data.csrfToken,
        callbackUrl: `${BASE_URL}/account`,
        json: 'true', email, password,
      },
    });
    assert.ok(result.status === 200 || result.status === 302,
      `${this.label}: credentials callback returned HTTP ${result.status}: ${JSON.stringify(result.data)}`);
    const session = await this.get('/api/auth/session');
    assert.equal(session.status, 200);
    assert.equal(session.data?.user?.email, email, `${this.label}: session email mismatch`);
    assert.ok(session.data?.user?.id, `${this.label}: session missing user ID`);
    return session.data.user;
  }

  async logout() {
    const csrf = await this.get('/api/auth/csrf');
    assert.ok(csrf.data?.csrfToken);
    await this.request('POST', '/api/auth/signout', {
      form: { csrfToken: csrf.data.csrfToken, callbackUrl: `${BASE_URL}/account`, json: 'true' },
    });
    const session = await this.get('/api/auth/session');
    assert.ok(!session.data?.user, `${this.label}: authenticated session survived sign-out`);
  }
}

function pass(message) { console.log(`PASS: ${message}`); }
function containsProduct(cart, productId) {
  return Array.isArray(cart?.lines) && cart.lines.some(line => line.product?.id === productId);
}
function wishlistContains(list, productId) {
  return Array.isArray(list) && list.some(product => product?.id === productId);
}
function expectStatus(response, expected, operation) {
  assert.equal(response.status, expected,
    `${operation}: expected ${expected}, got ${response.status}: ${JSON.stringify(response.data)}`);
}

const createdAccounts = [];
const browserA = new BrowserSession('Account A');
const browserB = new BrowserSession('Account B');
const nonce = randomBytes(8).toString('hex');
const testAccounts = [
  { browser: browserA, name: 'Tidewell API Test A', email: `tidewell-api-${nonce}-a@example.com`, password: randomBytes(24).toString('base64url') },
  { browser: browserB, name: 'Tidewell API Test B', email: `tidewell-api-${nonce}-b@example.com`, password: randomBytes(24).toString('base64url') },
];

async function cleanup(account) {
  if (!account.email.startsWith(`tidewell-api-${nonce}-`) || !/^acct-[a-f\d-]{36}$/i.test(account.id)) {
    throw new Error('Refusing cleanup of unexpected account identity');
  }
  const lookupKey = {
    PK: `AUTH_EMAIL#${createHash('sha256').update(account.email).digest('hex')}`,
    SK: 'LOOKUP',
  };
  const lookup = await db.send(new GetCommand({ TableName: TABLE, Key: lookupKey, ConsistentRead: true }));
  if (lookup.Item?.userId !== account.id) {
    throw new Error(`Refusing cleanup: email lookup mismatch for ${account.email}`);
  }
  const pk = `USER#${account.id}`;
  const items = [];
  let lastKey;
  do {
    const page = await db.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': pk },
      ExclusiveStartKey: lastKey,
      ConsistentRead: true,
    }));
    items.push(...(page.Items ?? []));
    lastKey = page.LastEvaluatedKey;
  } while (lastKey);
  for (const item of items) {
    if (item.PK !== pk || typeof item.SK !== 'string' ||
        !(/^(PROFILE|CREDENTIALS)$/.test(item.SK) || /^(CART|WISHLIST)#[a-z0-9-]+$/i.test(item.SK))) {
      throw new Error(`Refusing to delete unexpected record for ${account.email}`);
    }
    await db.send(new DeleteCommand({ TableName: TABLE, Key: { PK: pk, SK: item.SK } }));
  }
  await db.send(new DeleteCommand({ TableName: TABLE, Key: lookupKey }));
  console.log(`CLEANUP: removed temporary account ${account.email}`);
}

try {
  const catalogue = await browserA.get('/api/products');
  expectStatus(catalogue, 200, 'Read product catalogue');
  const products = Array.isArray(catalogue.data?.data) ? catalogue.data.data : catalogue.data?.data?.products;
  const available = (products ?? []).filter(p => p?.id && Number(p.stock) > 0);
  assert.ok(available.length >= 2, 'At least two in-stock seeded products are required');
  const [productA, productB] = available;
  pass('catalogue API responds with available products');

  for (const account of testAccounts) {
    const registration = await account.browser.post('/api/auth/register', {
      name: account.name, email: account.email, password: account.password,
    });
    expectStatus(registration, 201, `Register ${account.email}`);
    const id = registration.data?.data?.id;
    assert.match(id ?? '', /^acct-[a-f\d-]{36}$/i);
    createdAccounts.push({ email: account.email, id });
    const login = await account.browser.login(account.email, account.password);
    assert.equal(login.id, id, 'Login must resolve the registered account ID');
  }
  pass('two independent accounts registered and signed in');

  const [aCartPost, bCartPost] = await Promise.all([
    browserA.post('/api/cart', { productId: productA.id, quantity: 1 }),
    browserB.post('/api/cart', { productId: productB.id, quantity: 1 }),
  ]);
  expectStatus(aCartPost, 201, 'Add to A cart');
  expectStatus(bCartPost, 201, 'Add to B cart');
  const [aCart, bCart] = await Promise.all([browserA.get('/api/cart'), browserB.get('/api/cart')]);
  expectStatus(aCart, 200, 'A cart GET');
  expectStatus(bCart, 200, 'B cart GET');
  assert.ok(containsProduct(aCart.data.data, productA.id));
  assert.ok(!containsProduct(aCart.data.data, productB.id));
  assert.ok(containsProduct(bCart.data.data, productB.id));
  assert.ok(!containsProduct(bCart.data.data, productA.id));
  pass('cart data is isolated across authenticated accounts');

  const [aWishPost, bWishPost] = await Promise.all([
    browserA.post('/api/wishlist', { productId: productA.id }),
    browserB.post('/api/wishlist', { productId: productB.id }),
  ]);
  assert.ok([200, 201].includes(aWishPost.status), 'A wishlist add failed');
  assert.ok([200, 201].includes(bWishPost.status), 'B wishlist add failed');
  const [aWishlist, bWishlist] = await Promise.all([browserA.get('/api/wishlist'), browserB.get('/api/wishlist')]);
  assert.ok(wishlistContains(aWishlist.data?.data, productA.id));
  assert.ok(!wishlistContains(aWishlist.data?.data, productB.id));
  assert.ok(wishlistContains(bWishlist.data?.data, productB.id));
  assert.ok(!wishlistContains(bWishlist.data?.data, productA.id));
  pass('wishlist data is isolated across authenticated accounts');

  const [profileA, profileB] = await Promise.all([browserA.get('/api/user'), browserB.get('/api/user')]);
  assert.equal(profileA.data?.data?.email, testAccounts[0].email);
  assert.equal(profileB.data?.data?.email, testAccounts[1].email);
  pass('profile API returns the correct owner');

  const spoofedCart = await browserA.get(`/api/cart?userId=${encodeURIComponent(createdAccounts[1].id)}`);
  const spoofedUser = await browserA.get(`/api/user?userId=${encodeURIComponent(createdAccounts[1].id)}`);
  expectStatus(spoofedCart, 200, 'Cart with a forged userId query parameter');
  assert.ok(containsProduct(spoofedCart.data?.data, productA.id));
  assert.ok(!containsProduct(spoofedCart.data?.data, productB.id));
  assert.equal(spoofedUser.data?.data?.email, testAccounts[0].email);
  pass('client-supplied user IDs do not override the authenticated identity');

  const invalid = await browserA.post('/api/cart', { productId: productA.id, quantity: -1 });
  expectStatus(invalid, 400, 'Invalid cart quantity');
  const blockedOrigin = await browserA.post('/api/cart', { productId: productA.id, quantity: 1 }, 'https://example.invalid');
  expectStatus(blockedOrigin, 403, 'Cross-origin cart request');
  pass('invalid quantities and cross-origin mutations are rejected');

  await browserA.logout();
  const afterLogout = await browserA.get('/api/user');
  assert.notEqual(afterLogout.data?.data?.email, testAccounts[0].email,
    'Signed-out browser can still read authenticated profile');
  const stillSignedIn = await browserB.get('/api/auth/session');
  assert.equal(stillSignedIn.data?.user?.email, testAccounts[1].email);
  pass('signing out of A does not affect B or expose A profile');

  console.log('SUCCESS: All API account-isolation checks passed.');
} catch (error) {
  process.exitCode = 1;
  console.error('FAIL:', error instanceof Error ? error.message : String(error));
} finally {
  for (const account of createdAccounts) {
    try { await cleanup(account); }
    catch (error) {
      process.exitCode = 1;
      console.error(`CLEANUP FAILED for ${account.email}:`, error instanceof Error ? error.message : String(error));
    }
  }
  db.destroy();
}
