'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { gunzipSync, brotliDecompressSync } = require('node:zlib');
const path = require('node:path');

test(
  'a configured local Sentry DSN receives one scrubbed API exception through the real error handler',
  { timeout: 20000 },
  async (t) => {
    const events = [];
    const sink = http.createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      let bytes = Buffer.concat(chunks);
      if (req.headers['content-encoding'] === 'gzip') bytes = gunzipSync(bytes);
      if (req.headers['content-encoding'] === 'br')
        bytes = brotliDecompressSync(bytes);
      const lines = bytes.toString().trim().split('\n');
      for (let i = 1; i + 1 < lines.length; i += 2) {
        const header = JSON.parse(lines[i]);
        if (header.type === 'event') events.push(JSON.parse(lines[i + 1]));
      }
      res.setHeader('Content-Type', 'application/json');
      res.end('{}');
    });
    await new Promise((resolve) => sink.listen(0, '127.0.0.1', resolve));
    t.after(async () => {
      sink.closeAllConnections();
      await new Promise((resolve) => sink.close(resolve));
    });
    const script = `
    const monitoring=require('./src/telemetry/sentry');monitoring.init();
    const Sentry=require('@sentry/node'),express=require('express');
    const app=express();app.use(express.json());
    app.post('/local-error',(req,res,next)=>{
      Sentry.setUser({email:'private@example.com',username:'private-name'});
      Sentry.addBreadcrumb({message:'private-cookie',data:{question:'private-question'}});
      Sentry.setContext('request-copy',{body:req.body,cookie:req.headers.cookie});
      next(new Error('private@example.com private-question private-cookie'));
    });
    app.use(require('./src/middleware/error-handler').errorHandler);
    const server=app.listen(0,'127.0.0.1',async()=>{
      try {
        const r=await fetch('http://127.0.0.1:'+server.address().port+'/local-error?email=private@example.com',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'private-cookie'},body:JSON.stringify({question:'private-question'})});
        if(r.status!==500)throw Error('Expected a server failure');await r.text();
        if(!await Sentry.flush(5000))throw Error('Sentry flush timed out');
      } catch(error){console.error(error);process.exitCode=1;}
      finally{server.closeAllConnections();server.close();await Sentry.close(1000);}
    });`;
    const child = spawn(process.execPath, ['-e', script], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        SENTRY_DSN: `http://public@127.0.0.1:${sink.address().port}/1`,
        AUTH_SECRET: 'local-telemetry-test-secret',
        JWT_SECRET: 'local-telemetry-test-secret',
      },
    });
    let errors = '';
    child.stderr.on('data', (chunk) => {
      errors += chunk;
    });
    child.stdout.resume();
    t.after(() => child.kill('SIGTERM'));
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    assert.equal(code, 0, errors);
    assert.equal(events.length, 1);
    const serialized = JSON.stringify(events[0]);
    for (const value of [
      'private@example.com',
      'private-name',
      'private-cookie',
      'private-question',
    ])
      assert.equal(serialized.includes(value), false, value);
    assert.equal(events[0].user, undefined);
    assert.equal(events[0].request?.cookies, undefined);
    assert.equal(events[0].request?.data, undefined);
    assert.equal(events[0].request?.headers, undefined);
    assert.equal(events[0].exception.values[0].type, 'Error');
  },
);
