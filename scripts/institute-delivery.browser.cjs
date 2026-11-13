'use strict';
// UI acceptance with synthetic API responses; real persistence/isolation is tested separately.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),frontend=path.join(root,'exam-practice-pro'),origin='http://127.0.0.1:3022';
const output=path.join(root,'test-results','institute-delivery');fs.mkdirSync(output,{recursive:true});
const apiBase='/api/v1/institutes/synthetic-alpha';
let server,browser,page,role='teacher',banks=[],questions=[],exams=[],attempt=null,paid=false,cancelled=false;
const calls=[],errors=[];
const perms={owner:['workspace:read','members:read','members:invite','settings:write','banks:write','questions:write','questions:review','batches:write','exams:write','exams:publish','reports:read','billing:read'],teacher:['workspace:read','banks:write','questions:write','exams:write','assigned:reports'],student:['workspace:read','assigned:take','own:results']};
async function intercept(route){
 const request=route.request(),u=new URL(request.url()),method=request.method();
 const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)}),ok=data=>reply({success:true,data});
 if(u.hostname==='sdk.cashfree.com')return route.fulfill({contentType:'application/javascript',body:"window.Cashfree=()=>({checkout:async args=>{window.syntheticCheckout=args.paymentSessionId;}});"});
 if(u.pathname==='/api/auth/session')return reply({user:{name:'Synthetic '+role,email:role+'@example.test'},expires:'2099-01-01T00:00:00Z'});
 if(u.pathname==='/api/auth/backend-token')return reply({token:'synthetic-ui-only'});
 if(u.pathname.startsWith('/api/v1/')){
  const p=u.pathname;calls.push({path:p,method});
  if(p==='/api/v1/institutes/my')return ok({institutes:[{id:'a',slug:'synthetic-alpha',name:'Synthetic Alpha',status:'trial',role}]});
  if(p===apiBase+'/workspace')return ok({institute:{id:'a',slug:'synthetic-alpha',name:'Synthetic Alpha',status:'trial',profile:{}},role,permissions:perms[role],counts:null,activity:[],modules:{delivery:true,billing:true}});
  if(p===apiBase+'/banks'){
   if(method==='POST'){banks=[{id:'bank-a',...request.postDataJSON()}];return ok(banks[0]);}return ok({banks});
  }
  if(p===apiBase+'/banks/bank-a/questions'){
   if(method==='POST'){questions=[{id:'q-a',...request.postDataJSON(),review_status:'needs_review',version:1,retired_at:null}];return ok(questions[0]);}return ok({questions});
  }
  if(p===apiBase+'/questions/q-a/review'){questions[0].review_status='approved';return ok(questions[0]);}
  if(p===apiBase+'/batches')return ok({batches:[{id:'batch-a',name:'Synthetic batch'}]});
  if(p===apiBase+'/billing')return ok({subscription:paid?{plan_code:'SYNTHETIC',effectiveStatus:'active',limits:{students:10,teachers:1,batches:2,questions:100,monthlyAttempts:50},current_period_end:'2099-01-01',cancel_at_period_end:cancelled}:null,usage:{students:10,teachers:1,batches:1,questions:1,monthlyAttempts:1},quotasEnforced:true,orders:[{id:'order-a',plan_snapshot:{name:'Synthetic private quote',periodDays:30,limits:{students:10,teachers:1,batches:2,questions:100,monthlyAttempts:50}},amount_paise:12345,status:paid?'paid':'pending',expires_at:'2099-01-01'}],receipts:paid?[{id:'receipt-a',amount_paise:12345,currency:'INR',mode:'sandbox',period_start:'2026-11-11',period_end:'2026-12-11'}]:[]});
  if(p===apiBase+'/billing/orders/order-a/checkout'){assert.equal(request.postDataJSON().phone,'9999999999');return ok({paymentSessionId:'synthetic-billing-session',mode:'sandbox'});}
  if(p===apiBase+'/billing/orders/order-a/reconcile'){paid=true;return ok({status:'paid'});}
  if(p===apiBase+'/billing/cancel'){cancelled=true;return ok({cancelAtPeriodEnd:true});}

  if(p===apiBase+'/exams'){
   if(method==='POST'){const d=request.postDataJSON();exams=[{id:'exam-a',title:d.title,status:'draft',definition:d}];return ok(exams[0]);}return ok({exams});
  }
  if(p===apiBase+'/exams/exam-a/assignments'){assert.equal(request.postDataJSON().batchId,'batch-a');return ok({updated:true});}
  if(p===apiBase+'/exams/exam-a/publish'){assert.equal(questions[0].review_status,'approved');exams[0].status='published';return ok({status:'published'});}
  if(p===apiBase+'/assigned-exams')return ok({exams:exams.filter(e=>e.status==='published').map(e=>({...e,duration_minutes:10,question_count:1,starts_at:new Date(Date.now()-60000).toISOString(),ends_at:new Date(Date.now()+3600000).toISOString(),attempt_id:attempt?.id||null,submitted_at:attempt?.submittedAt||null}))});
  if(p===apiBase+'/exams/exam-a/start'){
   if(!attempt)attempt={id:'attempt-a',title:'Synthetic private exam',revision:0,responses:{},startedAt:new Date().toISOString(),deadlineAt:new Date(Date.now()+600000).toISOString(),serverNow:new Date().toISOString(),submittedAt:null,result:null,test:{sections:['Arithmetic'],marksPerCorrect:2,negativeMarks:0,questions:[{id:'q-a',section:'Arithmetic',question:'Synthetic browser question',options:['Alpha','Beta','Gamma','Delta']}]}};
   return ok({...attempt,serverNow:new Date().toISOString()});
  }
  if(p===apiBase+'/attempts/attempt-a'||p===apiBase+'/attempts/attempt-a/submit'){
   if(method!=='GET'){const data=request.postDataJSON();assert.equal(data.revision,attempt.revision);attempt.responses=data.responses;attempt.revision++;}
   if(p.endsWith('/submit')){attempt.submittedAt=new Date().toISOString();attempt.result={score:2,total:2,percentage:100,correct:1,incorrect:0,skipped:0};}
   return ok({...attempt,serverNow:new Date().toISOString()});
  }
  if(p===apiBase+'/results')return ok({results:attempt?[{id:attempt.id,title:attempt.title,submitted_at:attempt.submittedAt,result:attempt.result}]:[]});
  if(p===apiBase+'/batches/batch-a/report')return ok({attempts:attempt?.submittedAt?[{id:attempt.id,name:'Synthetic learner',title:attempt.title,submitted_at:attempt.submittedAt,result:attempt.result}]:[]});
  if(p===apiBase+'/batches/batch-a/analytics')return ok({summary:{eligible_assignments:10,students:10,exams:1,started:1,submitted:1,average_percentage:100,completion_percentage:10},performance:[{kind:'topic',name:'Arithmetic',questions:1,correct:1,incorrect:0,skipped:0}],scope:'Current active batch members and assigned published exams'});
  if(p===apiBase+'/batches/batch-a/export')return ok({csv:'"Student","Score"\r\n"Synthetic learner","2"\r\n',filename:'synthetic-batch-report.csv',count:1,nextOffset:null});

  return ok({user:{plan:'free',planActive:false},isGuest:false,tests:[]});
 }
 if(u.origin===origin)return route.continue();return route.abort();
}
(async()=>{try{
 server=spawn(process.execPath,[path.join(frontend,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3022'],{cwd:frontend,env:{...process.env,NODE_ENV:'production',AUTH_SECRET:'synthetic-ui-only'},stdio:'ignore'});
 for(let i=0;i<80;i++){try{if((await fetch(origin+'/institute')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',intercept);page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/institute/synthetic-alpha/questions');await page.getByLabel('Bank title',{exact:true}).fill('Synthetic private bank');await page.getByLabel('Exam code',{exact:true}).fill('SYN');await page.getByRole('button',{name:'Create bank',exact:true}).click();
 await page.getByRole('option',{name:'Synthetic private bank',exact:true}).waitFor({state:'attached'});await page.getByLabel('Select question bank',{exact:true}).selectOption('bank-a');
 for(const [label,value] of [['Original question ID','synthetic-ui-q'],['Topic','Arithmetic'],['Question text','Synthetic browser question'],['Option A','Alpha'],['Option B','Beta'],['Option C','Gamma'],['Option D','Delta'],['Private explanation','Synthetic private explanation']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Save question for review',exact:true}).click();await page.getByRole('button',{name:'Edit synthetic-ui-q',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Approve synthetic-ui-q',exact:true}).count(),0,'teacher cannot self-approve');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({animations:'disabled',path:path.join(output,'teacher-bank-desktop.png'),fullPage:true});
 await page.getByRole('link',{name:'Manage exams',exact:true}).click();await page.getByLabel('Exam title',{exact:true}).fill('Synthetic private exam');await page.getByLabel('Exam question bank',{exact:true}).selectOption('bank-a');
 await page.getByLabel('Duration in minutes',{exact:true}).fill('10');await page.getByLabel('Marks deducted per wrong answer',{exact:true}).fill('0');
 await page.getByLabel('Opens at (your local time)',{exact:true}).fill('2026-11-10T00:00');await page.getByLabel('Closes at (your local time)',{exact:true}).fill('2026-11-11T00:00');
 await page.getByRole('checkbox').check();await page.getByLabel('Section for synthetic-ui-q',{exact:true}).fill('Arithmetic');await page.getByRole('button',{name:'Save draft exam',exact:true}).click();await page.getByRole('button',{name:'Edit draft Synthetic private exam',exact:true}).waitFor();
 assert.equal(exams[0].definition.negativeMarks,0,'zero negative marks must be preserved');
 role='owner';await page.goto(origin+'/institute/synthetic-alpha/questions');await page.getByLabel('Select question bank',{exact:true}).selectOption('bank-a');await page.getByRole('button',{name:'Approve synthetic-ui-q',exact:true}).click();await page.getByText('Arithmetic · Easy · Revision 1 · approved',{exact:true}).waitFor();
 await page.getByRole('link',{name:'Manage exams',exact:true}).click();await page.getByLabel('Assign Synthetic private exam to batch',{exact:true}).selectOption('batch-a');await page.getByRole('button',{name:'Assign batch',exact:true}).click();
 await page.getByRole('button',{name:'Review publication for Synthetic private exam',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Confirm publication',exact:true}).click();await page.getByText('Synthetic private exam · published',{exact:true}).waitFor();
 role='student';await page.goto(origin+'/institute/synthetic-alpha/learn');assert.equal(await page.getByRole('link',{name:'Question banks',exact:true}).count(),0);await page.getByRole('button',{name:'Start exam',exact:true}).click();
 await page.getByRole('radio',{name:'A. Alpha',exact:true}).check();await page.getByRole('button',{name:'Save now',exact:true}).click();await page.getByText('1 / 1 answered · Saved to your account',{exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Resume exam',exact:true}).click();assert.equal(await page.getByRole('radio',{name:'A. Alpha',exact:true}).isChecked(),true);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({animations:'disabled',path:path.join(output,'student-exam-mobile-dark.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'private runner must fit mobile width');
 await page.getByRole('button',{name:'Submit institute exam',exact:true}).click();await page.getByRole('button',{name:'Confirm exam submission',exact:true}).click();await page.getByText('2 / 2 marks (100%)',{exact:true}).waitFor();assert.equal(await page.getByText('Synthetic private explanation',{exact:true}).count(),0,'review remains withheld before exam window closes');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({animations:'disabled',path:path.join(output,'student-result-mobile-dark.png'),fullPage:true});role='owner';await page.goto(origin+'/institute/synthetic-alpha/analytics');await page.getByLabel('Report batch',{exact:true}).selectOption('batch-a');
 await page.getByRole('heading',{name:'Topic and section performance',exact:true}).waitFor();await page.getByText('100%',{exact:true}).waitFor();
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download batch report CSV',exact:true}).click();assert.equal((await downloaded).suggestedFilename(),'synthetic-batch-report.csv');
 await page.getByText('Downloaded 1 permitted records. Export complete.',{exact:true}).waitFor();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({animations:'disabled',path:path.join(output,'batch-analytics-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 await page.getByRole('link',{name:'Billing & usage',exact:true}).click();await page.getByText('No verified institute subscription.',{exact:true}).waitFor();
 await page.getByLabel('Billing mobile number',{exact:true}).fill('9999999999');await page.getByRole('button',{name:'Test quoted checkout',exact:true}).click();await page.waitForFunction(()=>window.syntheticCheckout==='synthetic-billing-session');
 assert.equal(paid,false,'checkout callback must not activate a subscription');await page.getByRole('button',{name:'Check provider status',exact:true}).click();await page.getByText('Receipt receipt-a',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Cancel at period end',exact:true}).click();await page.getByRole('button',{name:'Confirm period-end cancellation',exact:true}).click();await page.getByText('Cancellation recorded; there is no automatic renewal.',{exact:true}).waitFor();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({animations:'disabled',path:path.join(output,'institute-billing-mobile.png'),fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 assert.deepEqual(errors,[]);
 assert.ok(calls.some(c=>c.path.endsWith('/submit')));console.log('PASS: synthetic question authoring, independent review controls, draft/assignment/publication, student autosave/refresh, mobile runner and result');
 }catch(error){if(page)await page.screenshot({animations:'disabled',path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;}finally{await browser?.close();server?.kill('SIGTERM');}})().catch(e=>{console.error(e);process.exitCode=1;});
