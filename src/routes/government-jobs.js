'use strict';
const {Router}=require('express');
const jobs=require('../services/government-jobs.service');
const router=Router();
// Public, no authentication required. Only curated official external sources are fetched.
router.get('/',async(_req,res,next)=>{
 try{
  res.set('Cache-Control','public, max-age=120, stale-while-revalidate=120');
  res.set('X-Robots-Tag','index, follow');
  res.json({success:true,data:await jobs.list()});
 }catch(e){next(e);}
});
module.exports=router;
