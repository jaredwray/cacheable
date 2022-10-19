import express from 'express'
import { caching } from 'cache-manager';

const app = express();
const cache = await caching('memory', {ttl: 10 * 1000, max: 500 })


app.get('/', async (_req, res) => res.send(await cache.wrap('foo', async () => "bar")));

// and somewhere else:

const _server = app.listen(3000, () => {
    console.log("Listen in 3000")
});
