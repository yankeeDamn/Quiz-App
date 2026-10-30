'use strict';
const {Router}=require('express');
const {authenticateNextAuth}=require('../middleware/nextauth');
const invitations=require('../services/beta-invitations.service');
const exams=require('../services/exam-attempts.service');
const feedback=require('../services/beta-feedback.service');
const router=Router();
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const ok=(res,data)=>res.json({success:true,data});
router.use((req,res,next)=>{
 res.set('Cache-Control','private, no-store');
 res.set('X-Robots-Tag','noindex, nofollow');
 next();
});
router.use(authenticateNextAuth);
router.post('/redeem',wrap(async(req,res)=>ok(res,await invitations.redeem(req.user,req.body?.code))));
router.get('/access',wrap(async(req,res)=>{
 await invitations.authorized(req.user);return ok(res,{testId:invitations.TEST_ID,authorized:true});
}));
router.post('/attempt',wrap(async(req,res)=>{
 await invitations.authorized(req.user);
 return ok(res,{attempt:await exams.start(req.user,invitations.TEST_ID,true)});
}));
async function getScoped(req){
 await invitations.authorized(req.user);
 const attempt=await exams.get(req.user.id,req.params.id,true);
 if(attempt.testId!=='draft-'+invitations.TEST_ID)
  throw Object.assign(new Error('Attempt not found.'),{statusCode:404});
 return attempt;
}
router.get('/attempts/:id',wrap(async(req,res)=>ok(res,{attempt:await getScoped(req)})));
router.put('/attempts/:id/progress',wrap(async(req,res)=>{
 await getScoped(req);
 return ok(res,{attempt:await exams.save(req.user.id,req.params.id,req.body?.responses,false,true)});
}));
router.post('/attempts/:id/submit',wrap(async(req,res)=>{
 await getScoped(req);
 return ok(res,{attempt:await exams.save(req.user.id,req.params.id,req.body?.responses,true,true)});
}));
router.post('/feedback',wrap(async(req,res)=>ok(res,await feedback.submit(req.user,req.body))));
module.exports=router;
