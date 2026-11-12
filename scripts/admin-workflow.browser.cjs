'use strict';
// Isolated UI acceptance: all identity/API data is synthetic and intercepted.
// No staging/production record or credential is used by this script.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),frontend=path.join(root,'exam-practice-pro');
const output=process.env.ADMIN_UI_ARTIFACT_DIR||path.join(root,'test-results','admin-workflow');
const port=Number(process.env.ADMIN_UI_PORT||3018),origin=`http://127.0.0.1:${port}`;
fs.mkdirSync(output,{recursive:true});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const id=i=>`11111111-1111-4111-8111-${String(i+1).padStart(12,'0')}`;
const questions=Array.from({length:12},(_,i)=>({id:id(i),position:i,question:`Synthetic training question ${i}: select the first label.`,options:['Label A','Label B','Label C','Label D'],answer:0,explanation:'Synthetic rationale: the first label is A.',difficulty:'Easy',active:i!==3,review_status:[0,2].includes(i)?'draft':'published',reviewed_at:[0,2].includes(i)?null:'2026-01-01T00:00:00Z',access_tier:'free',revision:String(i+1).padStart(64,'0')}));
const fixtureMock={id:'bank1',name:'Synthetic Bank Mock',exam:'Banking',minutes:12,marksPerCorrect:1,negativeMarks:0.25,level:'Practice',tier:'premium',passPercent:50,sections:[{name:'Training',parts:[{topic:'computer',from:0,to:3}]}],active:false,questionCount:1,configuredQuestionCount:3,liveInCatalogue:false,hiddenReason:'Draft — publish after review.',sectionTimingMinutes:null};
const liveMock={...fixtureMock,id:'live-synthetic',name:'Live Synthetic SSC',exam:'SSC',tier:'free',active:true,questionCount:3,liveInCatalogue:true,hiddenReason:null};
const blockedMock={...fixtureMock,id:'blocked-synthetic',name:'Blocked Synthetic Railways',exam:'Railways',active:true,hiddenReason:'One source question is missing.'};
const mockRows=[fixtureMock,liveMock,blockedMock,...Array.from({length:10},(_,i)=>({...fixtureMock,id:`training-${i}`,name:i===0?'=SUM(1,1)':`Training Draft ${i}`,tier:'free',minutes:20+i,configuredQuestionCount:10+i}))];
const calls=[],mockCalls=[],browserErrors=[];
let revision=30,serverLogs='',browser,server;
const topicRows=()=>[{id:'computer',name:'Computer Training',category:'Synthetic',active:true,total:12,live:questions.filter(q=>q.active&&q.review_status==='published').length},{id:'other',name:'Other Training',category:'Synthetic',active:true,total:1,live:0}];
function checklist(){
 const selected=questions.slice(0,3),ready=selected.filter(q=>q.active&&q.reviewed_at&&q.review_status==='published').length;
 return {testId:'bank1',name:fixtureMock.name,expected:3,present:3,ready,missing:0,unreviewed:3-ready,unpublished:3-ready,retired:0,topics:[{id:'computer',name:'Computer Training',exists:true,active:true,expected:3,present:3,missing:0,duplicates:0,unreviewed:3-ready,unpublished:3-ready,retired:0,tierMismatch:0,ready}],blockers:ready===3?[]:['Review and publish the remaining source questions.'],canPublish:ready===3,editorialRequired:false,editorialReady:null};
}
async function intercept(route){
 const request=route.request(),url=new URL(request.url());
 const headers={'access-control-allow-origin':'*','access-control-allow-headers':'Content-Type,Authorization','access-control-allow-methods':'GET,POST,PUT,OPTIONS'};
 const reply=(data,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(data)});
 if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(url.pathname==='/api/auth/session')return reply({user:{id:'synthetic-owner',name:'Review Owner',email:'owner@example.test'},expires:'2099-01-01T00:00:00.000Z'});
 if(url.pathname==='/api/auth/backend-token')return reply({token:'synthetic-bridge-token'});
 if(url.pathname.startsWith('/api/v1/')){
  const p=url.pathname.replace('/api/v1','');
  if(p==='/admin/me')return reply({success:true,data:{via:'account',email:'owner@example.test'}});
  if(p==='/admin/command-center')return reply({success:true,data:{questions:{total:13,active:12,topics:2},publication:{published:0,drafts:1},catalogue:{total:1,free:1,pro:0},attempts:{submitted:0,accuracy:null},plans:{active:0,manualGrants:0},checkedAt:'2026-11-02T00:00:00Z'}});
  if(p==='/admin/tests')return reply({success:true,data:{tests:mockRows}});
  if(p==='/admin/tests/publication-candidates')return reply({success:true,data:{candidates:[{id:'bank1',name:fixtureMock.name,ready:false,blocker:'Questions need review.'}]}});
  if(p==='/admin/tests/bank1/preview')return reply({success:true,data:{name:fixtureMock.name,minutes:12,questionCount:3,questions:questions.slice(0,3)}});
  if(p==='/admin/tests/bank1'&&request.method()==='PUT'){
   const body=request.postDataJSON();mockCalls.push(body);await delay(120);
   if(body.active&&!checklist().canPublish)return reply({success:false,error:{message:'Publication blocked: source questions need review.'}},409);
   Object.assign(fixtureMock,body);return reply({success:true,data:{test:fixtureMock}});
  }
  if(p==='/admin/catalogue')return reply({success:true,data:{tests:[{...liveMock,kind:'mock',isPro:false}]}});
  if(p==='/admin/topics')return reply({success:true,data:{topics:topicRows()}});
  if(p==='/admin/draft-testing/status')return reply({success:true,data:{enabled:true}});
  if(p==='/admin/tests/bank1/publication-checklist')return reply({success:true,data:checklist()});
  if(p==='/admin/topics/computer/questions')return reply({success:true,data:{questions}});
  if(p==='/admin/topics/other/questions'){await delay(300);return reply({success:true,data:{questions:[{...questions[0],id:'other-question',question:'Other topic only'}]}});}
  const matched=p.match(/^\/admin\/questions\/([^/]+)\/workflow$/);
  if(matched){
   const body=request.postDataJSON();calls.push(body);
   const q=questions.find(q=>q.id===matched[1]);assert.ok(q);
   if(body.revision!==q.revision)return reply({success:false,error:{message:'Question changed. Refresh and review again.'}},409);
   await delay(180);
   if(body.action==='review_publish'){assert.equal(body.acknowledged,true);q.review_status='published';q.reviewed_at='2026-11-02T00:00:00Z';}
   else if(body.action==='review'){assert.equal(body.acknowledged,true);q.review_status='reviewed';q.reviewed_at='2026-11-02T00:00:00Z';}
   else if(body.action==='publish'){assert.ok(q.reviewed_at);q.review_status='published';}
   else if(body.action==='access'){q.access_tier=body.tier;q.review_status='draft';q.reviewed_at=null;}
   else if(body.action==='retire')q.active=false;
   else if(body.action==='restore')q.active=true;
   else if(body.action==='draft'){q.review_status='draft';q.reviewed_at=null;}
   else throw Error('Unexpected synthetic workflow command');
   q.revision=String(++revision).padStart(64,'0');return reply({success:true,data:{question:{...q},changed:true}});
  }
  if(p.startsWith('/admin/'))throw Error('Unexpected admin API request '+request.method()+' '+p);
  return reply({success:true,data:{user:{plan:'free',planActive:false},isGuest:false,tests:[]}});
 }
 if(url.origin===origin)return route.continue();
 return route.abort(); // No external site, payment, identity or telemetry traffic.
}
(async()=>{
 try{
  server=spawn(process.execPath,[path.join(frontend,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:frontend,env:{...process.env,NODE_ENV:'production',AUTH_SECRET:'synthetic-ui-test-only-secret',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',b=>{serverLogs+=b;});server.stderr.on('data',b=>{serverLogs+=b;});
  let available=false;
  for(let i=0;i<80;i++){try{if((await fetch(origin+'/admin')).ok){available=true;break;}}catch{}await delay(250);}
  assert.ok(available,'Local production app did not start: '+serverLogs);
  browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
  await context.route('**/*',intercept);
  const page=await context.newPage();page.on('pageerror',e=>browserErrors.push(e.message));
  await page.goto(origin+'/admin');
  assert.equal(await page.getByRole('link',{name:'Chat on WhatsApp',exact:true}).count(),0,'floating support must not obscure admin actions');
  const manager=page.getByRole('region',{name:'Mock definitions manager',exact:true});
  await manager.getByText('13 of 13 definitions',{exact:true}).waitFor();
  assert.equal(await manager.getByRole('button',{name:'Next mock page',exact:true}).isDisabled(),false);
  await manager.getByRole('button',{name:'Next mock page',exact:true}).click();
  await manager.getByText('11–13 of 13',{exact:true}).waitFor();
  await manager.getByRole('button',{name:'Previous mock page',exact:true}).click();
  await manager.getByLabel('Filter mock tier',{exact:true}).selectOption('premium');
  await manager.getByText('2 of 13 definitions',{exact:true}).waitFor();
  await manager.getByLabel('Filter mock test category',{exact:true}).selectOption('Railways');
  await manager.getByText('1 of 13 definitions',{exact:true}).waitFor();
  await manager.getByRole('button',{name:'Clear filters',exact:true}).click();
  await manager.getByLabel('Filter mock status',{exact:true}).selectOption('live');
  await manager.getByRole('link',{name:'View live test',exact:true}).waitFor();
  assert.equal(await manager.getByRole('link',{name:'View live test',exact:true}).getAttribute('href'),'/india-mocks/live-synthetic?mode=test');
  await manager.getByRole('button',{name:'More actions for Live Synthetic SSC',exact:true}).click();
  await page.getByRole('menuitem',{name:'Copy student link',exact:true}).click();
  await manager.getByText(/Student link copied|Could not copy the link/).waitFor();
  await manager.getByRole('button',{name:'Clear filters',exact:true}).click();
  await manager.getByLabel('Sort mock tests',{exact:true}).selectOption('duration');
  const firstRow=manager.getByRole('row').nth(1);await firstRow.getByText('Training Draft 9',{exact:true}).waitFor();
  await manager.getByLabel('Sort mock tests',{exact:true}).selectOption('name');
  const downloadPromise=page.waitForEvent('download');await manager.getByRole('button',{name:'Export CSV',exact:true}).click();
  const download=await downloadPromise;const exported=fs.readFileSync(await download.path(),'utf8');
  assert.match(exported,/'=SUM\(1,1\)/,'metadata export neutralizes spreadsheet formula names');
  assert.equal(exported.includes('Synthetic training question'),false,'metadata export must not contain question content');
  assert.equal(exported.split('\r\n').length,14,'export includes all filtered definitions, not just the visible page');
  await manager.getByRole('button',{name:'Card layout',exact:true}).click();
  await manager.getByRole('article',{name:'Mock =SUM(1,1)',exact:true}).waitFor();
  await manager.getByRole('button',{name:'List layout',exact:true}).click();
  await manager.getByRole('button',{name:'More actions for Synthetic Bank Mock',exact:true}).click();
  await page.getByRole('menuitem',{name:'Preview questions',exact:true}).click();
  await page.getByRole('dialog').getByText('Synthetic training question 0: select the first label.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Close preview',exact:true}).click();
  await manager.getByRole('button',{name:'More actions for Synthetic Bank Mock',exact:true}).click();
  assert.equal(await page.getByRole('menuitem',{name:'Test draft privately',exact:true}).getAttribute('href'),'/admin/draft-test/bank1');
  await page.getByRole('menuitem',{name:'Edit mock settings',exact:true}).click();
  await page.getByRole('heading',{name:'Edit bank1',exact:true}).waitFor();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await manager.getByRole('button',{name:'More actions for Synthetic Bank Mock',exact:true}).click();
  await page.getByRole('menuitem',{name:'Duplicate as a draft',exact:true}).click();
  await page.getByRole('heading',{name:'New mock test',exact:true}).waitFor();
  assert.equal(await page.getByLabel('Name',{exact:true}).inputValue(),'Synthetic Bank Mock (Copy)');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await manager.getByRole('button',{name:'More actions for Synthetic Bank Mock',exact:true}).click();
  await page.getByRole('menuitem',{name:'Delete unused draft',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(mockCalls.length,0,'preview/edit/duplicate/delete cancel must not mutate the original mock');
  await manager.getByRole('button',{name:'Change access for Synthetic Bank Mock',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(mockCalls.length,0,'cancelled access confirmation must not save');
  await manager.getByRole('button',{name:'Change access for Synthetic Bank Mock',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Confirm access change',exact:true}).evaluate(button=>{button.click();button.click();});
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(mockCalls.length,1);assert.equal(mockCalls[0].tier,'free');assert.equal(fixtureMock.active,false);
  await manager.getByRole('button',{name:'Change access for Synthetic Bank Mock',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Confirm access change',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(fixtureMock.tier,'premium');
  await manager.getByRole('button',{name:'More actions for Synthetic Bank Mock',exact:true}).click();
  await page.getByRole('menuitem',{name:'Publish mock',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(mockCalls.length,2,'cancelled publication must not save');
  await manager.getByRole('button',{name:'More actions for Synthetic Bank Mock',exact:true}).click();
  await page.getByRole('menuitem',{name:'Publish mock',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Confirm publication',exact:true}).click();
  await page.getByRole('heading',{name:'Publication checklist · Synthetic Bank Mock',exact:true}).waitFor();
  assert.equal(fixtureMock.active,false,'server publication failure must leave the mock in draft');
  assert.equal(await page.getByRole('dialog').getByRole('button',{name:'Publish mock',exact:true}).isDisabled(),true);
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).first().click();
  await manager.getByRole('button',{name:'Check ready drafts',exact:true}).click();
  assert.equal(await page.getByRole('dialog').getByRole('button',{name:'Publish reviewed candidates',exact:true}).isDisabled(),true);
  await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
  await manager.getByRole('button',{name:'Refresh',exact:true}).click();
  await manager.getByText('13 of 13 definitions',{exact:true}).waitFor();
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({animations:'disabled',path:path.join(output,'mock-manager-desktop.png'),fullPage:true});
  await manager.getByRole('button',{name:'More actions for Synthetic Bank Mock',exact:true}).click();
  await page.getByRole('menuitem',{name:'Edit mock settings',exact:true}).waitFor();
  await page.screenshot({animations:'disabled',path:path.join(output,'mock-actions-menu.png'),fullPage:false});
  await page.keyboard.press('Escape');
  await page.getByRole('menu').waitFor({state:'detached'}); // Wait for popup exit before measuring mobile layout.
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.classList.add('dark'));
  assert.equal(await manager.evaluate(element=>element.scrollWidth<=element.clientWidth+1),true,'mock manager must fit mobile width');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({animations:'disabled',path:path.join(output,'mock-manager-mobile-dark.png'),fullPage:true});
  await manager.getByRole('article',{name:'Mock Synthetic Bank Mock',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({animations:'disabled',path:path.join(output,'mock-manager-mobile-actions.png'),fullPage:false});
  await page.setViewportSize({width:1440,height:1100});await page.evaluate(()=>document.documentElement.classList.remove('dark'));
  await page.getByRole('button',{name:'Live Catalogue',exact:true}).click();
  const catalogue=page.getByRole('region',{name:'Live learner catalogue',exact:true});
  await catalogue.getByRole('link',{name:'View test',exact:true}).waitFor();
  assert.equal(await catalogue.getByRole('link',{name:'View test',exact:true}).getAttribute('href'),'/india-mocks/live-synthetic?mode=test');
  await page.getByRole('button',{name:'All mock definitions (13)',exact:true}).click();
  await manager.getByRole('textbox',{name:'Search mock tests',exact:true}).fill('bank1');
  await page.getByRole('button',{name:'Review questions',exact:true}).click();
  await page.getByRole('heading',{name:'Computer Training',exact:true}).waitFor();
  const card0=page.getByRole('article',{name:'Question 0',exact:true});
  const card1=page.getByRole('article',{name:'Question 1',exact:true});
  await card0.getByRole('button',{name:'Review & publish',exact:true}).waitFor();
  assert.equal(await card1.getByRole('button',{name:'Published',exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole('button',{name:'Publish mock',exact:true}).count(),0);
  await page.screenshot({animations:'disabled',path:path.join(output,'question-workspace-desktop.png'),fullPage:true});
  await card0.getByRole('button',{name:'Review & publish',exact:true}).click();
  let dialog=page.getByRole('dialog');
  assert.equal(await dialog.getByRole('button',{name:'Review & publish',exact:true}).isDisabled(),true);
  await dialog.getByRole('checkbox').check();
  await page.screenshot({animations:'disabled',path:path.join(output,'review-confirmation.png'),fullPage:true});
  await dialog.getByRole('button',{name:'Publish & review next →',exact:true}).click();
  await dialog.getByText('Synthetic training question 2: select the first label.',{exact:true}).waitFor();
  assert.equal(await dialog.getByRole('checkbox').isChecked(),false,'next question needs a fresh acknowledgement');
  assert.equal(await dialog.getByRole('button',{name:'Review & publish',exact:true}).isDisabled(),true);
  assert.equal(calls.length,1);assert.equal(calls[0].action,'review_publish');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await card0.getByRole('button',{name:'Published',exact:true}).waitFor();
  const access=card1.getByRole('combobox',{name:'Access for question 1'});
  await access.selectOption('premium');dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(calls.length,1,'cancel must not change access or review');assert.equal(await access.inputValue(),'free');
  await access.selectOption('premium');dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Confirm change',exact:true}).click();
  await card1.getByRole('button',{name:'Review & publish',exact:true}).waitFor();
  assert.equal(calls.length,2);assert.equal(questions[1].reviewed_at,null);
  await page.getByRole('button',{name:'Next page',exact:true}).click();
  await page.getByRole('article',{name:'Question 10',exact:true}).waitFor();
  await page.getByRole('button',{name:'Previous page',exact:true}).click();
  await card0.waitFor();
  const topicPicker=page.getByLabel('Choose a topic',{exact:true});
  await topicPicker.selectOption('other');await topicPicker.selectOption('computer');
  await page.getByRole('heading',{name:'Computer Training',exact:true}).waitFor();await card0.waitFor();
  assert.equal(await page.getByText('Other topic only',{exact:true}).count(),0,'late topic responses must not replace the selected topic');
  await page.getByRole('button',{name:'Back to this mock',exact:true}).click();
  dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:'Publication checklist · Synthetic Bank Mock',exact:true}).waitFor();
  assert.equal(await dialog.getByRole('button',{name:'Publish mock',exact:true}).isDisabled(),true,'unfinished review must not enable mock publication');
  await dialog.getByRole('button',{name:'Close',exact:true}).first().click();
  await page.getByRole('button',{name:'Review questions',exact:true}).click();await card0.waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{document.documentElement.classList.add('dark');});
  assert.equal(await page.locator('#admin-section').evaluate(element=>element.scrollWidth<=element.clientWidth+1),true,'question workspace must fit mobile width');
  await page.screenshot({animations:'disabled',path:path.join(output,'question-workspace-mobile-dark.png'),fullPage:true});
  await page.goto(origin+'/contact');
  await page.getByRole('link',{name:'Chat on WhatsApp',exact:true}).waitFor();
  assert.deepEqual(browserErrors,[],'No unhandled browser errors');
  console.log('Admin UI acceptance passed: mock filters, sorting, pagination, CSV export, action menu, preview, editing/duplication/cancel, tier confirmation, blocked publication, mobile cards; acknowledgement reset, review/publish, access cancel/confirm, pagination, topic isolation, mock return, publication guard and mobile width.');
 }catch(error){
  if(browser){for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({animations:'disabled',path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});}
  console.error(error);console.error(serverLogs);process.exitCode=1;
 }finally{
  if(browser)await browser.close();if(server)server.kill('SIGTERM');
 }
})();
