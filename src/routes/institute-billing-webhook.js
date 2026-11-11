'use strict';
const express=require('express'),router=express.Router();
router.post('/webhook',express.raw({type:'application/json',limit:'64kb'}),(req,res,next)=>{
 res.set('Cache-Control','no-store');
 if(process.env.INSTITUTES_ENABLED!=='true'||process.env.INSTITUTE_BILLING_ENABLED!=='true')return res.status(404).json({error:'Institute billing is disabled'});
 require('../services/institutes/billing').webhook(req.body,req.get('x-webhook-signature'),req.get('x-webhook-timestamp')).then(data=>res.json({success:true,data})).catch(next);
});
module.exports=router;
