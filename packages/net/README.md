[<img align="center" src="https://cacheable.org/logo.svg" alt="Cacheable" />](https://github.com/jaredwray/cacheable)

> High Performance Network Caching for Node.js with fetch support and HTTP cache semantics

[![codecov](https://codecov.io/gh/jaredwray/cacheable/branch/main/graph/badge.svg?token=lWZ9OBQ7GM)](https://codecov.io/gh/jaredwray/cacheable)
[![tests](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/dm/@cacheable/net.svg)](https://www.npmjs.com/package/@cacheable/net)
[![npm](https://img.shields.io/npm/v/@cacheable/net.svg)](https://www.npmjs.com/package/@cacheable/net)
[![license](https://img.shields.io/github/license/jaredwray/cacheable)](https://github.com/jaredwray/cacheable/blob/main/LICENSE)

`@cacheable/net` is a high performance network layer for Node.js. It gives you a drop-in `fetch` with native semantics, ergonomic HTTP method helpers (`get`, `post`, `put`, `patch`, `delete`, `head`), and optional response caching powered by [`cacheable`](https://npmjs.com/package/cacheable) — including full [RFC 7234](http://httpwg.org/specs/rfc7234.html) HTTP cache semantics. It also ships first-class, cached **WHOIS** and **RDAP** lookups for domains, IP addresses, and ASNs.

* Drop-in `fetch` with native semantics — built on the runtime's global `fetch`, resolves with a `Response` on any status (check `response.ok`, never throws on `4xx`/`5xx`) and preserves `response.url`, `redirected`, and `type`
* HTTP method helpers — `get`, `post`, `put`, `patch`, `delete`, and `head` that return a typed `{ data, response }` and automatically (de)serialize JSON bodies
* Optional response caching via [`cacheable`](https://npmjs.com/package/cacheable) — layered (Layer 1 / Layer 2) caching, LRU, TTL expiration, distributed sync, and more
* [RFC 7234](http://httpwg.org/specs/rfc7234.html) compliant HTTP caching with `http-cache-semantics` (honors `Cache-Control`, `ETag`, `Last-Modified`, `Expires`, conditional revalidation, and `304 Not Modified`)
* Simple TTL-based caching mode for when you don't want HTTP semantics (`httpCachePolicy: false`)
* Smart, method-aware automatic cache key generation, with request coalescing in simple caching mode and for WHOIS/RDAP lookups (concurrent identical misses share one upstream request)
* Custom serialization / deserialization with `stringify` and `parse` — at the instance level or per request
* Request-level cache control with the `caching` option
* `whois` and `rdap` lookups for domains, IPv4/IPv6 addresses, and ASNs with **both raw and JSON output**, dynamic IANA server discovery, referral following, and built-in caching
* Extends [`hookified`](https://npmjs.com/package/hookified) so the instance is an event emitter / hookable object
* All the features of [`cacheable`](https://npmjs.com/package/cacheable) — layered caching, LRU, TTL expiration, tags, and more
* Full TypeScript support with comprehensive type definitions
* ESM and CommonJS builds
* Extensively tested with 100% code coverage

# Table of Contents
* [Getting Started](#getting-started)
* [Basic Usage](#basic-usage)
* [HTTP Method Helpers](#http-method-helpers)
* [Working with the Response](#working-with-the-response)
* [Using fetch Directly](#using-fetch-directly)
* [Caching Control](#caching-control)
* [HTTP Cache Semantics (RFC 7234)](#http-cache-semantics-rfc-7234)
* [Simple Caching Mode](#simple-caching-mode)
* [Custom Serialization](#custom-serialization)
* [Error Handling](#error-handling)
* [Using a Custom or Shared Cache](#using-a-custom-or-shared-cache)
* [Events](#events)
* [Standalone Functions](#standalone-functions)
* [WHOIS and RDAP Lookups](#whois-and-rdap-lookups)
  * [WHOIS](#whois)
  * [Following Referrals](#following-referrals)
  * [Standalone whois and whoisRaw](#standalone-whois-and-whoisraw)
  * [WhoisOptions](#whoisoptions)
  * [WhoisResult](#whoisresult)
  * [WHOIS Parsing Helpers](#whois-parsing-helpers)
  * [RDAP](#rdap)
  * [Standalone rdap](#standalone-rdap)
  * [RdapOptions](#rdapoptions)
  * [RdapResult](#rdapresult)
* [CacheableNet Options](#cacheablenet-options)
* [CacheableNet API](#cacheablenet-api)
* [Exports and Types](#exports-and-types)
* [How to Contribute](#how-to-contribute)
* [License and Copyright](#license-and-copyright)

# Getting Started

```bash
npm install @cacheable/net
```

`@cacheable/net` ships both ESM and CommonJS builds and includes its own TypeScript type definitions, so no `@types` package is required.

```javascript
// ESM
import { CacheableNet } from '@cacheable/net';
```

```javascript
// CommonJS
const { CacheableNet } = require('@cacheable/net');
```

# Basic Usage

Create a `CacheableNet` instance and use the method helpers. By default a `Cacheable` instance is created for you, GET requests are cached, and HTTP cache semantics are enabled.

```javascript
import { CacheableNet } from '@cacheable/net';

const net = new CacheableNet();

// Simple GET request with caching (the response body is parsed into `data`)
const { data, response } = await net.get('https://api.example.com/data');
console.log(response.status, data);

// POST request with a JSON body (serialized automatically)
const result = await net.post('https://api.example.com/users', {
  name: 'John Doe',
  email: 'john@example.com'
});
console.log(result.data);

// Using fetch directly returns the raw Response
const fetchResponse = await net.fetch('https://api.example.com/data', {
  method: 'GET',
  headers: { Authorization: 'Bearer token' }
});
console.log(await fetchResponse.json());
```

> `Net` is exported as an alias of `CacheableNet`, so `new Net()` and `new CacheableNet()` are equivalent.

# HTTP Method Helpers

All method helpers (except `fetch`) parse the response body and return a typed [`DataResponse<T>`](#working-with-the-response) of the shape `{ data, response }`. The `get`, `post`, `put`, `patch`, and `delete` helpers accept a generic type parameter so you can type the parsed `data`.

```javascript
import { CacheableNet } from '@cacheable/net';

const net = new CacheableNet();

// GET — cached by default
const { data } = await net.get('https://api.example.com/users/1');

// GET with a typed result (TypeScript)
type User = { id: number; name: string };
const { data: user } = await net.get<User>('https://api.example.com/users/1');

// POST — body is JSON-serialized and Content-Type set to application/json automatically
await net.post('https://api.example.com/users', { name: 'Ada' });

// PUT / PATCH — same body handling as POST
await net.put('https://api.example.com/users/1', { name: 'Ada Lovelace' });
await net.patch('https://api.example.com/users/1', { name: 'Ada' });

// DELETE — body is optional
await net.delete('https://api.example.com/users/1');

// HEAD — returns the raw Response (no body)
const head = await net.head('https://api.example.com/users/1');
console.log(head.headers.get('content-length'));
```

| Method | Signature | Returns | Caching |
|--------|-----------|---------|---------|
| `fetch` | `fetch(url, options?)` | `Promise<Response>` | GET requests only |
| `get` | `get<T>(url, options?)` | `Promise<DataResponse<T>>` | On by default (`caching: false` to disable) |
| `post` | `post<T>(url, data?, options?)` | `Promise<DataResponse<T>>` | Never cached |
| `put` | `put<T>(url, data?, options?)` | `Promise<DataResponse<T>>` | Opt-in with `caching: true` |
| `patch` | `patch<T>(url, data?, options?)` | `Promise<DataResponse<T>>` | Never cached |
| `delete` | `delete<T>(url, data?, options?)` | `Promise<DataResponse<T>>` | Never cached |
| `head` | `head(url, options?)` | `Promise<Response>` | Never cached |

**Body handling for `post` / `put` / `patch` / `delete`:** if `data` is a `string`, `FormData`, `URLSearchParams`, or `Blob` it is sent as-is; any other value is serialized with the [`stringify`](#custom-serialization) function (default `JSON.stringify`) and a `Content-Type: application/json` header is added when one is not already present.

# Working with the Response

Every helper that returns data resolves to a `DataResponse<T>`:

```typescript
type DataResponse<T = unknown> = {
  data: T;          // the parsed body (falls back to the raw text if parsing fails)
  response: Response; // a standard Response, reconstructed so the body can be read again
};
```

The `data` field is produced by running the response text through the [`parse`](#custom-serialization) function (default `JSON.parse`). If parsing throws (for example, the body is plain text), the raw string is returned instead, so a helper never rejects just because a body is not JSON.

The `response` is a standard `Response` with the native-`fetch` properties preserved — `response.ok`, `response.status`, `response.statusText`, `response.headers`, `response.url`, `response.redirected`, and `response.type` are all available, and because the body is reattached you can still call `response.text()` / `response.json()` on it.

```javascript
const { data, response } = await net.get('https://api.example.com/data');

if (response.ok) {
  console.log('final url after redirects:', response.url);
  console.log('etag:', response.headers.get('etag'));
  console.log('parsed body:', data);
}
```

# Using fetch Directly

`net.fetch` is a thin, caching wrapper over the runtime's global `fetch`. It returns the raw `Response` (it does **not** parse the body) and follows native semantics — it resolves on any status and only rejects on a network-level failure.

```javascript
const net = new CacheableNet();

const response = await net.fetch('https://api.example.com/data', {
  headers: { Accept: 'application/json' }
});

if (response.ok) {
  const json = await response.json();
  console.log(json);
}
```

`net.fetch` always uses the instance cache and the instance `httpCachePolicy` setting. To make a one-off request with different HTTP cache behavior, use the [standalone `fetch` function](#standalone-functions), which accepts a per-call `httpCachePolicy`.

# Caching Control

You can control caching at the instance level and per request.

* **GET** requests are cached by default. Pass `caching: false` to disable caching for a single GET request.
* **PUT** requests are **not** cached by default. Pass `caching: true` to cache a PUT.
* **POST**, **PATCH**, **DELETE**, and **HEAD** requests are **never** cached — the `caching` option has no effect on them and they always reach the network.

```javascript
import { CacheableNet } from '@cacheable/net';

const net = new CacheableNet();

// GET requests are cached by default
const data1 = await net.get('https://api.example.com/data');

// Disable caching for a specific GET request
const data2 = await net.get('https://api.example.com/data', { caching: false });

// POST requests are never cached
const result1 = await net.post('https://api.example.com/data', { value: 1 });

// Enable caching for a PUT request (PUT is the only write method that caches)
const result2 = await net.put('https://api.example.com/data', { value: 1 }, { caching: true });
```

> **Note:** When caching is enabled on a PUT, an identical request is matched by **method and URL only** — the request body is not part of the cache key, so two PUTs to the same URL with different bodies share one cache entry. Only successful responses are ever cached.

# HTTP Cache Semantics (RFC 7234)

By default (`httpCachePolicy: true`) responses are cached according to [RFC 7234](http://httpwg.org/specs/rfc7234.html) using [`http-cache-semantics`](https://www.npmjs.com/package/http-cache-semantics). In this mode the library:

* Respects standard HTTP cache headers (`Cache-Control`, `ETag`, `Last-Modified`, `Expires`)
* Stores and validates cache policies per RFC 7234, only caching responses that are "storable"
* Sets the cache TTL from HTTP headers (for example the `max-age` directive)
* Issues conditional requests with `If-None-Match` / `If-Modified-Since` when an entry needs revalidation
* Processes `304 Not Modified` responses to refresh the cached entry and its TTL
* Automatically revalidates stale entries

```javascript
import { CacheableNet } from '@cacheable/net';

// HTTP cache semantics are on by default
const net = new CacheableNet({ httpCachePolicy: true });

// TTL is derived from the response's Cache-Control: max-age, ETag, etc.
const { data } = await net.get('https://api.example.com/data');
```

# Simple Caching Mode

Set `httpCachePolicy: false` to use simple key-based caching that ignores HTTP cache directives. In this mode the library:

* Caches every successful GET response regardless of cache directives
* Uses the default TTL from the `Cacheable` instance
* Never revalidates cached entries
* Coalesces concurrent identical misses so the origin is hit only once

```javascript
import { CacheableNet } from '@cacheable/net';

const net = new CacheableNet({
  httpCachePolicy: false,
  cache: { ttl: '5m' } // every cached GET lives for 5 minutes
});

const { data } = await net.get('https://api.example.com/data');
```

In either mode, error responses (`4xx` / `5xx`) are always returned to the caller but are **never** cached, so a transient failure is never replayed from a cache hit.

# Custom Serialization

You can provide custom `stringify` and `parse` functions for handling data serialization. This is particularly useful when working with complex data types that JSON doesn't natively support. They can be set on the instance (constructor option or the `stringify` / `parse` properties) or overridden per request.

```javascript
import { CacheableNet } from '@cacheable/net';
import superjson from 'superjson';

// Using superjson for enhanced serialization
// Supports Dates, BigInt, RegExp, Set, Map, Error and more
const net = new CacheableNet({
  stringify: (value) => superjson.stringify(value),
  parse: (text) => superjson.parse(text)
});

// Now you can work with complex data types
const response = await net.post('https://api.example.com/data', {
  timestamp: new Date(),
  userId: BigInt(12345),
  pattern: /[a-z]+/gi,
  metadata: new Map([['key', 'value']]),
  tags: new Set(['important', 'urgent'])
});

// Or provide per-request custom serialization
const result = await net.get('https://api.example.com/data', {
  // Custom parsing with superjson for this request only
  parse: (text) => superjson.parse(text)
});
```

You can also read or replace the functions after construction:

```javascript
net.stringify = (value) => superjson.stringify(value);
net.parse = (text) => superjson.parse(text);
```

# Error Handling

`@cacheable/net` follows native `fetch` semantics. It **resolves** with a `Response` for every completed HTTP exchange — including `4xx` and `5xx` — and only rejects when the request itself fails (DNS failure, connection refused, abort, etc.). Use `response.ok` (or `response.status`) to detect HTTP errors instead of a `try/catch`:

```javascript
const net = new CacheableNet();

const { response, data } = await net.get('https://api.example.com/thing');
if (!response.ok) {
  // 404, 500, etc. — `data` holds any error body the server returned
  throw new Error(`Request failed with status ${response.status}`);
}
```

Only successful responses are cached. Under the default HTTP cache mode, `2xx` responses are cached per RFC 7234 (honoring `Cache-Control`, `ETag`, `Expires`, etc.); in simple mode (`httpCachePolicy: false`) every `2xx` response is cached. Error responses (`4xx`/`5xx`) are always returned to the caller but **never** cached, so a transient failure is never replayed from a cache hit.

# Using a Custom or Shared Cache

The `cache` option accepts either a [`Cacheable`](https://npmjs.com/package/cacheable) instance or `CacheableOptions`. Passing options lets `@cacheable/net` construct the instance; passing an instance lets you share one cache across your application and unlocks the full `cacheable` feature set (Layer 1 / Layer 2 storage, distributed sync, tags, statistics, and more).

```javascript
import { CacheableNet } from '@cacheable/net';

// Construct a cache from options
const net = new CacheableNet({
  cache: { ttl: '1h' }
});
```

```javascript
import { CacheableNet } from '@cacheable/net';
import { Cacheable } from 'cacheable';
import KeyvRedis from '@keyv/redis';

// Share a Layer 1 (memory) + Layer 2 (Redis) cache
const cache = new Cacheable({
  secondary: new KeyvRedis('redis://localhost:6379'),
  ttl: '1h'
});

const net = new CacheableNet({ cache });

// The underlying cache is available on the instance
await net.cache.set('manual:key', 'value');
console.log(await net.cache.get('manual:key'));

// Swap the cache at runtime
net.cache = new Cacheable();
```

To learn everything the cache can do — layered storage, TTL shorthand (`'1h'`, `'5m'`), `maxTtl`, tag-based invalidation, `CacheableSync`, and statistics — see the [`cacheable` documentation](https://npmjs.com/package/cacheable).

# Events

`CacheableNet` extends [`hookified`](https://npmjs.com/package/hookified), so each instance is an event emitter / hookable object (`on`, `once`, `off`, `emit`, `onHook`, `removeHook`, …) and accepts `HookifiedOptions` in its constructor.

Caching events such as cache hits and misses are emitted by the underlying `Cacheable` instance, which you can reach through `net.cache`:

```javascript
import { CacheableNet } from '@cacheable/net';
import { CacheableEvents } from 'cacheable';

const net = new CacheableNet();

net.cache.on(CacheableEvents.CACHE_HIT, (data) => {
  console.log('cache hit:', data.key);
});
net.cache.on(CacheableEvents.CACHE_MISS, (data) => {
  console.log('cache miss:', data.key);
});
net.cache.on(CacheableEvents.ERROR, (error) => {
  console.error('cache error:', error.message);
});
```

# Standalone Functions

If you don't need an instance, the underlying functions are exported directly. Pass a `cache` in the options to enable caching; without one the request is still made, just not cached. These functions use `JSON.stringify` / `JSON.parse` for body handling.

```javascript
import { fetch, get, post, patch, del, head } from '@cacheable/net';
import { Cacheable } from 'cacheable';

const cache = new Cacheable();

// fetch — no cache needed; returns the raw Response
const response = await fetch('https://api.example.com/data');

// fetch with caching and a per-call HTTP cache policy
const cached = await fetch('https://api.example.com/data', {
  cache,
  httpCachePolicy: false // override per call (only available on the standalone fetch)
});

// get / post / patch / del — return { data, response }
// Pass `cache` to enable caching. As with the class helpers, only GET
// responses are cached; post/patch/del always bypass the cache.
const { data } = await get('https://api.example.com/data', { cache });
await post('https://api.example.com/data', { value: 1 }, { cache });
await patch('https://api.example.com/data', { value: 1 }, { cache });

// del accepts an optional body; you can also call it with options only
await del('https://api.example.com/data/1', undefined, { cache });
await del('https://api.example.com/data/1', { cache });

// head — returns the raw Response (no body)
const headResponse = await head('https://api.example.com/data', { cache });
```

> The standalone helpers cover `fetch`, `get`, `post`, `patch`, `del` (DELETE), and `head`. There is no standalone `put`; use `net.put` (or the `fetch` function with `method: 'PUT'`) for PUT requests. `del` is named `del` because `delete` is a reserved word.
>
> Except for `fetch` (whose options argument is optional), each standalone helper needs an options argument — pass at least `{}` to `get`, `post`, `patch`, and `head`, and pass `del` an options object (as its second argument, or third when you also send a body). Calling them with the options omitted throws.

# WHOIS and RDAP Lookups

`@cacheable/net` ships first-class lookups for domains, IP addresses (v4/v6), and ASNs over both the traditional **WHOIS** protocol (TCP port 43) and the modern **RDAP** protocol (HTTPS/JSON). WHOIS returns the registry's **raw text** which is also parsed into a JSON object, while RDAP returns native JSON. The authoritative server is discovered dynamically through IANA and cached, so you never have to ship or maintain a static list of TLD servers.

Because WHOIS and RDAP servers are heavily rate-limited, results are cached (and concurrent identical lookups are coalesced) using the same `cacheable` instance as the rest of the library.

## WHOIS

```javascript
import { CacheableNet } from '@cacheable/net';

const net = new CacheableNet();

const result = await net.whois('example.com');

result.query;   // the normalized query that was looked up
result.type;    // "domain" | "ipv4" | "ipv6" | "asn"
result.server;  // the authoritative server that produced the data
result.raw;     // the full raw WHOIS text (all hops joined by a blank line)
result.fields;  // parsed JSON, e.g. { "Domain Name": "EXAMPLE.COM", "Name Server": ["A", "B"] }
result.hops;    // every server response in order (registry, registrar, ...)
```

`whois` accepts domains, full URLs, IPv4/IPv6 addresses, and ASNs (the query is normalized first — scheme, `www.`, path, port, and trailing dots are stripped, and internationalized domains are converted to punycode):

```javascript
await net.whois('https://www.example.com/path'); // normalized to example.com
await net.whois('8.8.8.8');                       // IPv4 lookup
await net.whois('2001:4860:4860::8888');          // IPv6 lookup
await net.whois('AS15169');                       // ASN lookup
```

## Following Referrals

By default a registry response's `Registrar WHOIS Server` referral is followed to fetch fuller data. Control this with the `follow` option (`false`/`0` to disable, `true` for the default depth of 2, or a number of hops):

```javascript
const shallow = await net.whois('example.com', { follow: false }); // registry only
const deep = await net.whois('example.com', { follow: 2 });        // follow up to 2 referrals
```

## Standalone whois and whoisRaw

You can also use the standalone functions. `whois` returns the full result; `whoisRaw` returns just the raw text. The standalone functions cache only when you pass a `cache` instance in the options.

```javascript
import { whois, whoisRaw } from '@cacheable/net';

const { fields } = await whois('8.8.8.8');        // IP address lookup
const { fields: asn } = await whois('AS15169');   // ASN lookup
const raw = await whoisRaw('example.com');        // raw text only

// With caching
import { Cacheable } from 'cacheable';
const cache = new Cacheable();
const result = await whois('example.com', { cache });
```

## WhoisOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `server` | `string` | – | Query this server directly and skip IANA discovery |
| `port` | `number` | `43` | TCP port for the initial server |
| `timeout` | `number` | `10000` | Socket timeout in milliseconds |
| `follow` | `boolean \| number` | `true` | Follow registry → registrar referrals (`true` = depth 2, `false`/`0` = none) |
| `queryPrefix` | `string` | `""` | Text written before the query (e.g. `"domain "` for some registries) |
| `encoding` | `BufferEncoding` | `"utf8"` | Encoding used to decode responses |
| `bootstrapServer` | `string` | `"whois.iana.org"` | The bootstrap WHOIS server used when no `server` is provided |
| `bootstrapPort` | `number` | `43` | TCP port of the bootstrap WHOIS server |
| `caching` | `boolean` | `true` | Disable caching for this lookup when `false` |
| `cache` | `Cacheable` | instance cache | Cache instance (standalone `whois` caches only when provided) |
| `ttl` | `number \| string` | instance default | TTL override for the cached result |

## WhoisResult

```typescript
type WhoisResult = {
  query: string;                  // the normalized query that was looked up
  type: WhoisQueryType;           // "domain" | "ipv4" | "ipv6" | "asn"
  server: string;                 // the final authoritative server that produced the primary data
  raw: string;                    // the raw text across all hops, separated by a blank line
  fields: WhoisFields;            // merged parsed fields across all hops (repeats become arrays)
  hops: WhoisHop[];               // every server response, in the order they were queried
};

type WhoisFields = Record<string, string | string[]>;

type WhoisHop = {
  server: string;                 // the server queried for this hop
  port: number;                   // the TCP port used for this hop
  raw: string;                    // the raw text returned by this server
  fields: WhoisFields;            // the parsed key/value fields for this hop
};
```

## WHOIS Parsing Helpers

The lower-level building blocks used by `whois` are exported so you can normalize, classify, parse, or query servers yourself:

```javascript
import {
  normalizeWhoisQuery,
  detectQueryType,
  parseWhois,
  queryWhoisServer
} from '@cacheable/net';

normalizeWhoisQuery('https://www.Example.com/'); // "example.com"
detectQueryType('AS15169');                       // "asn"

// Parse raw WHOIS text into a key/value object (repeats become arrays)
const fields = parseWhois('Domain Name: EXAMPLE.COM\nName Server: A\nName Server: B');
// => { "Domain Name": "EXAMPLE.COM", "Name Server": ["A", "B"] }

// Query a single WHOIS server directly over TCP and get the raw text back
const raw = await queryWhoisServer({
  host: 'whois.verisign-grs.com',
  query: 'example.com',
  timeout: 10000
});
```

| Function | Signature | Description |
|----------|-----------|-------------|
| `normalizeWhoisQuery` | `(input: string) => string` | Strip scheme/`www.`/path/port/trailing dots, lowercase, and punycode-encode IDNs |
| `detectQueryType` | `(value: string) => WhoisQueryType` | Classify a normalized query as `domain`, `ipv4`, `ipv6`, or `asn` |
| `parseWhois` | `(raw: string) => WhoisFields` | Parse raw WHOIS text into key/value fields (repeated keys become arrays) |
| `queryWhoisServer` | `(options: QueryWhoisServerOptions) => Promise<string>` | Open a raw WHOIS TCP connection to one server and return its text response |

`QueryWhoisServerOptions` accepts `host`, `query`, and optional `port` (default `43`), `queryPrefix` (default `""`), `timeout` (default `10000`), and `encoding` (default `"utf8"`).

## RDAP

RDAP is the modern, fully structured replacement for WHOIS. The RDAP server is resolved from the IANA bootstrap registries (fetched and cached through the library's own `fetch`).

```javascript
import { CacheableNet } from '@cacheable/net';

const net = new CacheableNet();

const result = await net.rdap('example.com');
result.query;  // the normalized query
result.type;   // "domain" | "ipv4" | "ipv6" | "asn"
result.server; // the RDAP base URL used
result.raw;    // raw JSON text
result.data;   // parsed RDAP object
```

## Standalone rdap

The standalone `rdap` function supports domains, IPs, and ASNs, and caches only when you pass a `cache` instance.

```javascript
import { rdap } from '@cacheable/net';

const domain = await rdap('example.com');
const ip = await rdap('1.1.1.1');
const asn = await rdap('AS15169');

// With caching
import { Cacheable } from 'cacheable';
const cache = new Cacheable();
const cached = await rdap('example.com', { cache });
```

## RdapOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `server` | `string` | – | Query this RDAP base URL directly and skip bootstrap discovery |
| `bootstrapUrl` | `string` | `https://data.iana.org/rdap` | Override the IANA bootstrap base URL |
| `headers` | `Record<string, string>` | – | Additional request headers |
| `caching` | `boolean` | `true` | Disable caching for this lookup when `false` |
| `cache` | `Cacheable` | instance cache | Cache instance (standalone `rdap` caches only when provided) |
| `ttl` | `number \| string` | instance default | TTL override for the cached result |

## RdapResult

```typescript
type RdapResult = {
  query: string;                  // the normalized query that was looked up
  type: WhoisQueryType;           // "domain" | "ipv4" | "ipv6" | "asn"
  server: string;                 // the RDAP base URL that produced the data
  raw: string;                    // the raw JSON text returned by the server
  data: Record<string, unknown>;  // the parsed RDAP object
};
```

# CacheableNet Options

The constructor accepts `CacheableNetOptions`, which also extends `HookifiedOptions`:

```typescript
type CacheableNetOptions = {
  cache?: Cacheable | CacheableOptions;    // Cacheable instance or options (default: new Cacheable())
  httpCachePolicy?: boolean;               // Enable HTTP cache semantics (default: true)
  stringify?: (value: unknown) => string;  // Custom serializer (default: JSON.stringify)
  parse?: (value: string) => unknown;      // Custom parser (default: JSON.parse)
} & HookifiedOptions;
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cache` | `Cacheable \| CacheableOptions` | `new Cacheable()` | An existing cache instance, or options to construct one |
| `httpCachePolicy` | `boolean` | `true` | Use RFC 7234 HTTP cache semantics; set `false` for simple TTL-based caching |
| `stringify` | `(value: unknown) => string` | `JSON.stringify` | Serializer for request bodies and cached values |
| `parse` | `(value: string) => unknown` | `JSON.parse` | Parser for response bodies |

Request options for the method helpers use `NetFetchOptions`, which extends the standard `fetch` `RequestInit` (minus `method` and `cache`, which are managed internally):

```typescript
type NetFetchOptions = {
  caching?: boolean;                        // Enable/disable caching for this request
  stringify?: (value: unknown) => string;   // Per-request serializer override
  parse?: (value: string) => unknown;       // Per-request parser override
} & Omit<FetchOptions, 'method' | 'cache'>;

type FetchOptions = Omit<RequestInit, 'cache'> & {
  cache?: Cacheable;          // Cache instance (used by the standalone functions)
  httpCachePolicy?: boolean;  // HTTP cache semantics for this request (standalone fetch only)
};
```

# CacheableNet API

### Properties

* `cache: Cacheable` — get/set the underlying `Cacheable` instance used for caching.
* `httpCachePolicy: boolean` — get/set whether HTTP cache semantics are enabled.
* `stringify: (value: unknown) => string` — get/set the serializer used for request bodies.
* `parse: (value: string) => unknown` — get/set the parser used for response bodies.

### Methods

* `fetch(url, options?)` — fetch with caching support; returns the raw `Response`.
* `get<T>(url, options?)` — GET request; returns `DataResponse<T>`. Cached by default (`caching: false` to disable).
* `post<T>(url, data?, options?)` — POST request; serializes `data` and returns `DataResponse<T>`. Never cached.
* `put<T>(url, data?, options?)` — PUT request; serializes `data` and returns `DataResponse<T>`. Not cached by default; pass `caching: true` to cache.
* `patch<T>(url, data?, options?)` — PATCH request; serializes `data` and returns `DataResponse<T>`. Never cached.
* `delete<T>(url, data?, options?)` — DELETE request; optionally serializes `data` and returns `DataResponse<T>`. Never cached.
* `head(url, options?)` — HEAD request; returns the raw `Response` (no body). Never cached.
* `whois(query, options?)` — WHOIS lookup; returns a `WhoisResult` with raw text and parsed fields.
* `rdap(query, options?)` — RDAP lookup; returns an `RdapResult` with raw JSON and parsed data.

Inherited from [`hookified`](https://npmjs.com/package/hookified): `on`, `once`, `off`, `emit`, `onHook`, `removeHook`, and the rest of the event/hook API.

# Exports and Types

`@cacheable/net` exports the following from its entry point:

**Classes**

* `CacheableNet` — the main class.
* `Net` — an alias for `CacheableNet`.

**Standalone functions**

* `fetch`, `get`, `post`, `patch`, `del`, `head` — HTTP helpers (no standalone `put`).
* `whois`, `whoisRaw`, `rdap` — registration data lookups.
* `normalizeWhoisQuery`, `detectQueryType`, `parseWhois`, `queryWhoisServer` — WHOIS building blocks.

**Types**

* `CacheableNetOptions`, `NetFetchOptions`, `StringifyType`, `ParseType`
* `FetchOptions`, `FetchRequestInit`, `FetchResponse`, `DataResponse`, `GetResponse`
* `WhoisOptions`, `WhoisResult`, `WhoisFields`, `WhoisHop`, `WhoisQueryType`, `QueryWhoisServerOptions`
* `RdapOptions`, `RdapResult`

> `FetchResponse` is the runtime `Response` type and `GetResponse` is a backward-compatible alias of `DataResponse`.

# How to Contribute

You can contribute by forking the repo and submitting a pull request. Please make sure to add tests and update the documentation. To learn more about how to contribute go to our main README [https://github.com/jaredwray/cacheable](https://github.com/jaredwray/cacheable). This will talk about how to `Open a Pull Request`, `Ask a Question`, or `Post an Issue`.

# License and Copyright
[MIT © Jared Wray](./LICENSE)
