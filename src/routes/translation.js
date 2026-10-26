'use strict';

const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const router = Router();
const translationLimiter = rateLimit({
  windowMs: 15*60*1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: {success:false,error:{message:'Translation quota reached. Try again later.'}},
});

function checkTranslation(body) {
  if (!body || !['hi','bn'].includes(body.lang) ||
      !Array.isArray(body.texts) || body.texts.length === 0 || body.texts.length > 6 ||
      body.texts.some(s => typeof s !== 'string' || s.trim().length < 1 || s.length > 1000)) {
    return null;
  }
  return {lang:body.lang,texts:body.texts.map(s=>s.trim())};
}

/**
 * Optional Azure AI Translator. Key/region are SERVER-SIDE only.
 * Not a new source of answer keys; only translate text already visible to the learner.
 */
router.post('/', translationLimiter, async (req,res,next)=>{
  try {
    const input=checkTranslation(req.body);
    if(!input) return res.status(400).json({success:false,error:{message:'Send 1–6 text strings (up to 1000 characters each) and lang hi or bn.'}});
    const key=process.env.AZURE_TRANSLATOR_KEY;
    const region=process.env.AZURE_TRANSLATOR_REGION;
    if(!key || !region) return res.status(503).json({success:false,error:{code:'TRANSLATION_NOT_CONFIGURED',message:'Automatic translation is not configured; English is available.'}});
    const endpoint=process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com';
    const url=new URL('/translate?api-version=3.0&from=en&to='+input.lang,endpoint);
    // Restrict outbound translation traffic to Azure Translator hosts.
    if(url.protocol!=='https:' || !(/(^|\.)cognitive\.microsofttranslator\.com$|(^|\.)cognitiveservices\.azure\.com$/).test(url.hostname)) {
      return res.status(503).json({success:false,error:{message:'Translator endpoint is not an approved Azure domain.'}});
    }
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),6500);
    let upstream;
    try {
      upstream=await fetch(url,{
        method:'POST',signal:controller.signal,
        headers:{'Content-Type':'application/json','Ocp-Apim-Subscription-Key':key,'Ocp-Apim-Subscription-Region':region},
        body:JSON.stringify(input.texts.map(text=>({text}))),
      });
    } finally {clearTimeout(timeout);}
    if(!upstream.ok) return res.status(503).json({success:false,error:{message:'Translator service unavailable. Showing original English.'}});
    const response=await upstream.json();
    if(!Array.isArray(response) || response.length!==input.texts.length ||
        response.some(item=>typeof item?.translations?.[0]?.text!=='string')) {
      return res.status(502).json({success:false,error:{message:'Translator returned an unexpected response.'}});
    }
    res.set('Cache-Control','no-store');
    return res.json({success:true,data:{lang:input.lang,texts:response.map(item=>item.translations[0].text)}});
  }catch(e) {
    if(e.name==='AbortError')return res.status(504).json({success:false,error:{message:'Translation timed out; showing English.'}});
    return next(e);
  }
});

module.exports={router,checkTranslation};
