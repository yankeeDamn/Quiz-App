'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PDFDocument}=require('pdf-lib');
const db=require('../src/config/database');
const {createEbooksService,validateBook}=require('../src/services/ebooks.service');
const {createRouters}=require('../src/routes/ebooks');
const original=db.query;
test.afterEach(()=>{db.query=original;});
async function fixture({accessLevel='pro',download=true,paid=false,legacy=false,bundled=false}={}) {
 const pdf=await PDFDocument.create(); for(let i=0;i<5;i++)pdf.addPage();
 const bytes=Buffer.from(await pdf.save());
 const book={...structuredClone(require('../content/ebooks-starter.json')[0]),slug:'paid-guide',accessLevel,freePreviewPages:2,allowFullPdfDownload:download,allowPdfDownload:download,isBundledPublicEdition:bundled,pdfUrl:'/api/v1/ebooks/paid-guide/pdf'};
 db.query=async(sql)=>{
  if(sql.includes('monetization_documents'))return {rows:legacy?[{document:{isFreemiumGated:true,freePreviewChapters:2}}]:[]};
  if(sql.includes('monetization_grants')){assert.match(sql,/expires_at>now\(\)/);return {rows:[],rowCount:paid?1:0};}
  throw Error('Unexpected query '+sql);
 };
 const local={query:async(sql)=>{
  if(sql.includes('FROM ebooks '))return {rows:[{slug:book.slug,visibility:'public',document:book,revision:1,access_level:book.accessLevel,free_preview_pages:2,allow_full_pdf_download:download,is_bundled_public_edition:bundled}]};
  if(sql.includes('ebook_access'))return {rows:[]};
  if(sql.includes('ebook_pdf_assets'))return {rows:[{filename:'book.pdf',bytes}]};
  throw Error(sql);
 }};
 return {service:createEbooksService(local),book,bytes};
}
const user={id:'learner',email:'learner@example.test',plan:'free'};
test('Free PDF is complete; Pro PDF is two pages for guests and expired users',async()=>{
 for(const [accessLevel,identity,expected] of [['free',null,5],['pro',null,2],['pro',{...user,plan:'pro',planExpiresAt:'2000-01-01'},2]]) {
  const {service}=await fixture({accessLevel}); const result=await service.pdf('paid-guide',identity);
  assert.equal((await PDFDocument.load(result.bytes)).getPageCount(),expected);
  assert.equal(result.preview,expected===2);
 }
});
test('verified pass returns complete PDF even with sales disabled; Free access overrides legacy gates',async()=>{
 const old=process.env.MONETIZATION_ENABLED;process.env.MONETIZATION_ENABLED='false';
 try {
  let f=await fixture({paid:true});assert.equal((await PDFDocument.load((await f.service.pdf('paid-guide',user)).bytes)).getPageCount(),5);
  f=await fixture({accessLevel:'free',legacy:true});assert.equal((await PDFDocument.load((await f.service.pdf('paid-guide',null)).bytes)).getPageCount(),5);
  f=await fixture({accessLevel:'pro',bundled:true});assert.equal((await PDFDocument.load((await f.service.pdf('paid-guide',null)).bytes)).getPageCount(),5);
 }finally{if(old===undefined)delete process.env.MONETIZATION_ENABLED;else process.env.MONETIZATION_ENABLED=old;}
});
test('active Pro subscription returns the complete PDF without an ebook-specific pass',async()=>{
 const {service}=await fixture({accessLevel:'pro'});
 const active={...user,plan:'pro',planExpiresAt:'2099-01-01T00:00:00.000Z'};
 const result=await service.pdf('paid-guide',active);
 assert.equal(result.preview,false);
 assert.equal((await PDFDocument.load(result.bytes)).getPageCount(),5);
});
test('disabled download is enforced by backend while authorized reading remains available',async()=>{
 const {service}=await fixture({download:false,paid:true});
 await assert.rejects(service.pdf('paid-guide',user,true),/disabled/);
 assert.equal((await service.pdf('paid-guide',user)).preview,false);
});
test('all direct PDF aliases return only preview bytes and private cache headers',async()=>{
 const {service}=await fixture();const express=require('express'),app=express();
 const identity=(_req,res)=>res.sendStatus(401);
 app.use('/ebooks',createRouters(service,identity).router);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 try{
  const base=`http://127.0.0.1:${server.address().port}/ebooks/paid-guide`;
  for(const path of ['/pdf','/read','/download','/pdf?download=1&previewPages=999&pro=true']) {
   const response=await fetch(base+path);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
   assert.equal(response.headers.get('x-ebook-preview'),'true');
   assert.equal((await PDFDocument.load(await response.arrayBuffer())).getPageCount(),2);
  }
  assert.equal((await fetch(base+'/read',{headers:{Authorization:'Bearer forged'}})).status,401);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('validation rejects external Pro PDFs, public bundle paywall and invalid page limits',()=>{
 const b=structuredClone(require('../content/ebooks-starter.json')[0]);
 assert.throws(()=>validateBook({...b,accessLevel:'pro'},b.slug),/stay Free/);
 assert.throws(()=>validateBook({...b,accessLevel:'pro',pdfUrl:'https://example.test/full.pdf'},'paid-guide'),/privately/);
 for(const freePreviewPages of [0,-1,1.5,21,51])assert.throws(()=>validateBook({...b,freePreviewPages},'paid-guide'),/Preview pages/);
});
