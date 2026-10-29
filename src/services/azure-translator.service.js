'use strict';

const crypto = require('node:crypto');

// In-memory, bounded cache only. Neither the question bank nor translated
// strings are persisted in Neon. A cold Render instance simply retranslates.
const CACHE_MAX = 1500;
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const cache = new Map();
// Best-effort per-instance spending brake. Use Azure F0 quota, service
// metrics and Azure budget alerts for reliable subscription-level controls.
let dailyUsage={day:'',characters:0};
function dayKey(){return new Date().toISOString().slice(0,10);}
function dailyLimit(){
  const n=Number(process.env.AZURE_TRANSLATOR_DAILY_CHARS||60000);
  return Number.isInteger(n)&&n>=1000&&n<=2000000?n:60000;
}


function validTexts(texts) {
  return Array.isArray(texts) && texts.length > 0 && texts.length <= 8 &&
    texts.every(t => typeof t === 'string' && t.trim().length > 0 && t.length <= 1000) &&
    texts.reduce((sum,t)=>sum+t.length,0) <= 3600;
}
function fail(message,statusCode=502) {
  return Object.assign(new Error(message),{statusCode});
}
function cacheKey(language,text) {
  return crypto.createHash('sha256').update(JSON.stringify([language,text])).digest('hex');
}
function getCached(key) {
  const entry=cache.get(key);
  if(!entry)return null;
  if(entry.expires <= Date.now()){cache.delete(key);return null;}
  cache.delete(key);cache.set(key,entry); // LRU refresh
  return entry.value;
}
function remember(key,value) {
  if(cache.has(key))cache.delete(key);
  cache.set(key,{value,expires:Date.now()+CACHE_TTL});
  while(cache.size>CACHE_MAX)cache.delete(cache.keys().next().value);
}

/** No caller-controlled hosts: avoid SSRF and secret exfiltration. */
function endpointUrl() {
  const configured=(process.env.AZURE_TRANSLATOR_ENDPOINT||'https://api.cognitive.microsofttranslator.com').trim();
  let endpoint;
  try{ endpoint=new URL(configured); }catch {throw fail('Invalid Azure Translator endpoint configuration.',503);}
  if(endpoint.protocol!=='https:' || endpoint.username || endpoint.password ||
    endpoint.search || endpoint.hash ||
    !(endpoint.hostname==='api.cognitive.microsofttranslator.com' ||
      endpoint.hostname.endsWith('.cognitiveservices.azure.com'))) {
    throw fail('Azure Translator endpoint must use an approved HTTPS Azure domain.',503);
  }
  const root=endpoint.pathname.replace(/\/+$/,'');
  const suffix=root.endsWith('/translate')?'': '/translate';
  endpoint.pathname=root+suffix;
  endpoint.searchParams.set('api-version','3.0');
  return endpoint;
}

/**
 * Display translations only. NEVER write to mock_questions, change keys,
 * flag review approval, or translate anything except explicitly requested
 * English text. Caller enforces access control and rate limits.
 */
async function translate(texts,language) {
  if(!['hi','bn'].includes(language)||!validTexts(texts))throw fail('Invalid language or text batch.',400);
  const key=process.env.AZURE_TRANSLATOR_KEY;
  if(!key)throw fail('Azure Translator is not configured on this API.',503);
  const outputs=new Array(texts.length);
  const missing=new Map();
  let cacheHits=0;
  for(let i=0;i<texts.length;i++){
    const digest=cacheKey(language,texts[i]);
    const cached=getCached(digest);
    if(cached!==null){outputs[i]=cached;cacheHits++;}
    else if(missing.has(digest))missing.get(digest).indices.push(i);
    else missing.set(digest,{text:texts[i],indices:[i],digest});
  }
  if(missing.size){
    const day=dayKey();
    if(dailyUsage.day!==day)dailyUsage={day,characters:0};
    const requested=[...missing.values()].reduce((n,v)=>n+v.text.length,0);
    if(dailyUsage.characters+requested>dailyLimit()) {
      throw fail('Translation daily character budget reached. Try again later or switch to English.',503);
    }
    const url=endpointUrl();
    url.searchParams.set('from','en');
    url.searchParams.set('to',language);
    const headers={
      'Content-Type':'application/json',
      'Ocp-Apim-Subscription-Key':key,
    };
    if(process.env.AZURE_TRANSLATOR_REGION) {
      headers['Ocp-Apim-Subscription-Region']=process.env.AZURE_TRANSLATOR_REGION;
    }
    let response;
    try{
      response=await fetch(url,{
        method:'POST',headers,signal:AbortSignal.timeout(9000),
        body:JSON.stringify([...missing.values()].map(v=>({Text:v.text}))),
      });
    }catch{throw fail('Azure Translator timed out or could not be reached. Retry later.',502);}
    if(!response.ok) {
      if(response.status===429)return Promise.reject(fail('Azure translation quota or rate limit reached.',503));
      throw fail('Azure Translator rejected this request. Check the resource key, region and quota.',502);
    }
    let data;
    try {data=await response.json();}catch{throw fail('Azure Translator returned an invalid response.',502);}
    if(!Array.isArray(data)||data.length!==missing.size)throw fail('Azure Translator returned an incomplete translation.',502);
    dailyUsage.characters+=requested;
    const vals=[...missing.values()];
    for(let i=0;i<vals.length;i++){
      const localized=data[i]?.translations?.find(t=>t.to===language)?.text;
      if(typeof localized!=='string'||!localized.trim())throw fail('Azure Translator returned an incomplete translation.',502);
      for(const ix of vals[i].indices)outputs[ix]=localized;
      remember(vals[i].digest,localized);
    }
  }
  return {texts:outputs,provider:'azure',advisory:true,cached:cacheHits};
}
function resetCacheForTests(){cache.clear();dailyUsage={day:'',characters:0};}
module.exports={validTexts,translate,endpointUrl,resetCacheForTests};
