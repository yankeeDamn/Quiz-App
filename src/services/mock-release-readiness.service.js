'use strict';
// Read-only release checks. Never changes mock state, review rows or topic flags.
const content=require('./content.service');
const quality=require('./mock-quality.service');
const {isFullCglMock}=require('./ssc-full-mock-classifier');

async function report(testId){
 const tests=await content.listTests();
 const definition=tests.find(t=>t.id===testId);
 if(!definition)throw Object.assign(new Error('Mock not found.'),{statusCode:404});
 if(!isFullCglMock(definition))throw Object.assign(new Error('Full SSC CGL release report is not applicable.'),{statusCode:400});
 const reviews=await quality.list(testId);
 const publication=await content.publicationReadiness(definition);
 const academic={approved:reviews.academicApproved,required:reviews.expected};
 const hindi={verified:reviews.hindiVerified,required:reviews.hindiRequired};
 const stale=reviews.entries.filter(e=>e.stale).length;
 const missing=Math.max(0,reviews.expected-reviews.actual);
 const editorialReady=reviews.ready&&reviews.expected===100&&reviews.hindiRequired===75&&stale===0;
 const checks=[
  {id:'bank',label:'All 100 configured question records present',passed:reviews.actual===100&&reviews.expected===100},
  {id:'academic',label:'100 academic approvals recorded',passed:academic.approved===100&&academic.required===100},
  {id:'hindi',label:'75 non-English Hindi approvals recorded',passed:hindi.verified===75&&hindi.required===75},
  {id:'freshness',label:'Approvals match current source revisions',passed:stale===0},
  {id:'publication',label:'Active source topics and publication pattern checks',passed:publication.ok===true},
 ];
 return {
  testId,name:definition.name,draft:!definition.active,academic,hindi,
  questions:{expected:reviews.expected,actual:reviews.actual,missing,stale},
  editorialReady,technicalReady:checks.every(c=>c.passed),
  // Human beta and security signoffs cannot be inferred from database rows.
  humanSignoffRequired:true,publicationPerformed:false,
  checks,publicationBlocker:publication.ok?null:publication.error,
 };
}
module.exports={report};
