'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const service=require('../src/services/azure-translator.service');

const oldFetch=global.fetch;
const oldKey=process.env.AZURE_TRANSLATOR_KEY;
const oldRegion=process.env.AZURE_TRANSLATOR_REGION;
const oldEndpoint=process.env.AZURE_TRANSLATOR_ENDPOINT;
const oldBudget=process.env.AZURE_TRANSLATOR_DAILY_CHARS;
const restore=()=>{
 global.fetch=oldFetch;
 for(const [name,value] of Object.entries({
  AZURE_TRANSLATOR_KEY:oldKey,
  AZURE_TRANSLATOR_REGION:oldRegion,
  AZURE_TRANSLATOR_ENDPOINT:oldEndpoint,
  AZURE_TRANSLATOR_DAILY_CHARS:oldBudget,
 })) {if(value===undefined)delete process.env[name];else process.env[name]=value;}
 service.resetCacheForTests();
};
test.after(restore);

test('validation rejects large batches, empty strings and unsupported languages',async()=>{
 assert.equal(service.validTexts(['Where is Delhi?','Option A']),true);
 assert.equal(service.validTexts(Array(9).fill('A')),false);
 assert.equal(service.validTexts(Array(8).fill('x'.repeat(500))),false);
 assert.equal(service.validTexts(['']),false);
 await assert.rejects(service.translate(['Hello'],'fr'),{statusCode:400});
 await assert.rejects(service.translate([''],'hi'),{statusCode:400});
});

test('endpoint never permits arbitrary URLs or non-Azure domains',()=>{
 process.env.AZURE_TRANSLATOR_ENDPOINT='https://api.cognitive.microsofttranslator.com';
 assert.equal(service.endpointUrl().hostname,'api.cognitive.microsofttranslator.com');
 assert.equal(service.endpointUrl().pathname,'/translate');
 process.env.AZURE_TRANSLATOR_ENDPOINT='https://exampro-test.cognitiveservices.azure.com/translator/text/v3.0';
 assert.equal(service.endpointUrl().pathname,'/translator/text/v3.0/translate');
 for(const v of [
  'http://api.cognitive.microsofttranslator.com',
  'https://api.cognitive.microsofttranslator.com.evil.invalid',
  'https://evil.invalid',
  'https://attacker@api.cognitive.microsofttranslator.com',
  'https://api.cognitive.microsofttranslator.com/?a=b',
 ]) {
  process.env.AZURE_TRANSLATOR_ENDPOINT=v;
  assert.throws(()=>service.endpointUrl(),e=>e.statusCode===503);
 }
});

test('Azure call stays server side, preserves input order, caches per language and question text',async()=>{
 service.resetCacheForTests();
 process.env.AZURE_TRANSLATOR_KEY='test-only-not-a-real-key';
 process.env.AZURE_TRANSLATOR_REGION='centralindia';
 process.env.AZURE_TRANSLATOR_ENDPOINT='https://api.cognitive.microsofttranslator.com';
 process.env.AZURE_TRANSLATOR_DAILY_CHARS='60000';
 const requests=[];
 global.fetch=async(url,options)=>{
  requests.push({url:String(url),options});
  const texts=JSON.parse(options.body);
  return {ok:true,json:async()=>texts.map(v=>({
   translations:[{to:new URL(String(url)).searchParams.get('to'),text:'translated: '+v.Text}],
  }))};
 };
 const source=['Question?','Option A','Option B','Option C','Option D'];
 const first=await service.translate(source,'hi');
 assert.deepEqual(first.texts,source.map(v=>'translated: '+v));
 assert.equal(first.advisory,true);
 assert.equal(first.provider,'azure');
 assert.equal(requests.length,1);
 assert.equal(requests[0].options.headers['Ocp-Apim-Subscription-Key'],'test-only-not-a-real-key');
 assert.equal(requests[0].options.headers['Ocp-Apim-Subscription-Region'],'centralindia');
 assert.equal(new URL(requests[0].url).searchParams.get('from'),'en');
 const cached=await service.translate(source,'hi');
 assert.equal(cached.cached,5);
 assert.equal(requests.length,1);
 const changed=await service.translate(['Question?','New option'],'hi');
 assert.equal(changed.cached,1);
 assert.equal(requests.length,2);
 const bengali=await service.translate(['Question?'],'bn');
 assert.equal(bengali.cached,0);
 assert.equal(requests.length,3);
 assert.equal(new URL(requests[2].url).searchParams.get('to'),'bn');
});

test('server refuses missing key, Azure outage, wrong response and character budget overage',async()=>{
 service.resetCacheForTests();
 delete process.env.AZURE_TRANSLATOR_KEY;
 await assert.rejects(service.translate(['A'],'hi'),{statusCode:503});
 process.env.AZURE_TRANSLATOR_KEY='test-only';
 process.env.AZURE_TRANSLATOR_ENDPOINT='https://api.cognitive.microsofttranslator.com';
 global.fetch=async()=>({ok:false,status:429});
 await assert.rejects(service.translate(['B'],'hi'),e=>e.statusCode===503);
 global.fetch=async()=>({ok:true,json:async()=>[]});
 await assert.rejects(service.translate(['C'],'hi'),e=>e.statusCode===502);
 global.fetch=async(url,options)=>({ok:true,json:async()=>JSON.parse(options.body).map(v=>({
  translations:[{to:'hi',text:'हिंदी'}],
 }))});
 process.env.AZURE_TRANSLATOR_DAILY_CHARS='1000';
 await service.translate(['x'.repeat(900)],'hi');
 await assert.rejects(service.translate(['y'.repeat(200)],'hi'),e=>e.statusCode===503);
 const cached=await service.translate(['x'.repeat(900)],'hi');
 assert.equal(cached.cached,1,'cache hit does not bill a second time');
});

test('authenticated exam proxy requires a valid bearer and admin generator cannot auto-approve',async()=>{
 process.env.NODE_ENV='test';
 const app=require('../src/app');
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 try{
  const res=await oldFetch('http://127.0.0.1:'+server.address().port+'/api/v1/exampro/translate-exam',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({language:'hi',texts:['hello']}),
  });
  assert.equal(res.status,401);
 }finally{
  await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 }
 const fs=require('node:fs'),path=require('node:path');
 const reviewer=fs.readFileSync(path.resolve(__dirname,'../exam-practice-pro/components/admin/mock-review.tsx'),'utf8');
 assert.match(reviewer,/hindiStatus:'pending'/,'Azure must never set human-verified status');
 assert.match(reviewer,/Generate Hindi draft with Azure/);
 const backend=fs.readFileSync(path.resolve(__dirname,'../src/routes/exampro-features.js'),'utf8');
 assert.match(backend,/router\.post\('\/translate-exam',authenticateNextAuth,examTranslateLimiter/);
});


test('provider errors give safe auth/region/endpoint hints without leaking secrets',async()=>{
 service.resetCacheForTests();
 process.env.AZURE_TRANSLATOR_KEY='super-secret-test-only-key';
 process.env.AZURE_TRANSLATOR_ENDPOINT='https://api.cognitive.microsofttranslator.com';
 for(const [status,expected] of [[401,/authentication failed/],[403,/authentication failed/],
   [404,/endpoint was not found/],[400,/rejected the text request/]]) {
  global.fetch=async()=>({ok:false,status});
  await assert.rejects(service.translate(['Unique test '+status],'hi'),err=>{
   assert.equal(err.statusCode,502);
   assert.match(err.message,expected);
   assert.doesNotMatch(err.message,/super-secret-test-only-key/);
   return true;
  });
 }
});

test('Render proxy is trusted one hop only, and exam translation has an independent user quota',()=>{
 const {shouldSkipGeneralRateLimit}=require('../src/middleware/rate-limiter');
 assert.equal(shouldSkipGeneralRateLimit({originalUrl:'/api/v1/exampro/translate-exam'}),true);
 assert.equal(shouldSkipGeneralRateLimit({originalUrl:'/api/v1/exampro/translate-exam?lang=hi'}),true);
 assert.equal(shouldSkipGeneralRateLimit({originalUrl:'/api/v1/exampro/translate'}),false);
 assert.equal(shouldSkipGeneralRateLimit({originalUrl:'/api/v1/exampro/translate-exam-other'}),false);
 const app=require('../src/app');
 const fs=require('node:fs'),path=require('node:path');
 const server=fs.readFileSync(path.resolve(__dirname,'../src/app.js'),'utf8');
 assert.match(server,/if \(process\.env\.RENDER_SERVICE_ID\) \{\s*app\.set\('trust proxy', 1\)/);
 assert.equal(typeof app.get('trust proxy'),'boolean','unit-test app does not trust spoofed X-Forwarded-For');
});


test('malformed Azure batches are atomic: failed requests never poison the translation cache',async()=>{
 service.resetCacheForTests();
 process.env.AZURE_TRANSLATOR_KEY='fake-key-pr55-only';
 process.env.AZURE_TRANSLATOR_REGION='eastus';
 process.env.AZURE_TRANSLATOR_ENDPOINT='https://api.cognitive.microsofttranslator.com';
 process.env.AZURE_TRANSLATOR_DAILY_CHARS='60000';
 let requests=0;
 global.fetch=async()=>{
  requests++;
  return {ok:true,json:async()=>[
   {translations:[{to:'hi',text:'पहला वैध अनुवाद'}]},
   {translations:[{to:'bn',text:'wrong target language'}]},
  ]};
 };
 await assert.rejects(service.translate(['First prompt','Second prompt'],'hi'),
   e=>e.statusCode===502&&/incomplete translation/.test(e.message));
 global.fetch=async(_url,options)=>{
  requests++;
  return {ok:true,json:async()=>JSON.parse(options.body).map(v=>({
   translations:[{to:'hi',text:'fresh '+v.Text}],
  }))};
 };
 const retry=await service.translate(['First prompt','Second prompt'],'hi');
 assert.deepEqual(retry.texts,['fresh First prompt','fresh Second prompt']);
 assert.equal(retry.cached,0,'neither item from a failed batch may be reused');
 assert.equal(requests,2);
 const repeat=await service.translate(['First prompt','Second prompt'],'hi');
 assert.equal(repeat.cached,2);
 assert.equal(requests,2);
});
