'use strict';
// Synthetic UI-only acceptance. Provider OAuth and real DB are separate suites.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),frontend=path.join(root,'exam-practice-pro'),origin='http://127.0.0.1:3021';
const output=path.join(root,'test-results','institute-workspace');fs.mkdirSync(output,{recursive:true});
let server,browser,role='owner',invites=[],calls=[];
const perms={owner:['workspace:read','members:read','members:invite','members:revoke','staff:admin','settings:write'],student:['workspace:read']};
async function intercept(route){const request=route.request(),u=new URL(request.url()),reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(u.pathname==='/api/auth/session')return reply({user:{name:'Synthetic Owner',email:'synthetic@example.test'},expires:'2099-01-01T00:00:00Z'});
 if(u.pathname==='/api/auth/backend-token')return reply({token:'synthetic-ui-only'});
 if(u.pathname.startsWith('/api/v1/')){
  const p=u.pathname;calls.push({path:p,method:request.method()});
  if(p==='/api/v1/institutes/my')return reply({success:true,data:{institutes:[{id:'a',slug:'synthetic-alpha',name:'Synthetic Alpha',status:'trial',role},{id:'b',slug:'synthetic-beta',name:'Synthetic Beta',status:'active',role:'student'}]}});
  if(p.endsWith('/workspace'))return reply({success:true,data:{institute:{id:'a',slug:'synthetic-alpha',name:'Synthetic Alpha',status:'trial',profile:{}},role,permissions:perms[role],counts:role==='owner'?{students:10,batches:0,published_exams:0,submitted_attempts:0}:null,activity:[]}});
  if(p.endsWith('/members'))return reply({success:true,data:{members:[{user_id:'u',name:'Synthetic Student',email:'student@example.test',role:'student',status:'active'}]}});
  if(p.endsWith('/invitations')&&request.method()==='GET')return reply({success:true,data:{invitations:invites}});
  if(p.endsWith('/invitations')&&request.method()==='POST'){assert.equal(request.postDataJSON().email,'invited@example.test');invites=[{id:'i',email:'invited@example.test',role:'teacher',expires_at:'2099-01-01',accepted_at:null,revoked_at:null}];return reply({success:true,data:{id:'i',token:'synthetic-invitation-token'}});}
  if(p.endsWith('/settings'))return reply({success:true,data:{}});
  return reply({success:true,data:{user:{plan:'free',planActive:false},isGuest:false,tests:[]}});
 }
 if(u.origin===origin)return route.continue();return route.abort();
}
(async()=>{try{
 server=spawn(process.execPath,[path.join(frontend,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3021'],{cwd:frontend,env:{...process.env,NODE_ENV:'production',AUTH_SECRET:'synthetic-ui-only'},stdio:'ignore'});
 for(let i=0;i<80;i++){try{if((await fetch(origin+'/institute')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',intercept);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/institute');await page.getByRole('link',{name:'Synthetic Alpha owner · trial'}).waitFor();
 await page.getByRole('link',{name:'Synthetic Alpha owner · trial'}).click();await page.getByRole('heading',{name:'Synthetic Alpha',exact:true}).waitFor();
 await page.getByRole('link',{name:'Members & invitations'}).click();await page.getByText('student@example.test',{exact:true}).waitFor();
 await page.getByLabel('Verified email',{exact:true}).fill('invited@example.test');await page.getByLabel('Member role',{exact:true}).selectOption('teacher');await page.getByRole('button',{name:'Create invitation'}).click();
 await page.getByLabel('Invitation token',{exact:true}).waitFor();assert.equal(await page.getByLabel('Invitation token',{exact:true}).inputValue(),'synthetic-invitation-token');
 await page.getByRole('button',{name:'Hide token'}).click();assert.equal(await page.getByLabel('Invitation token',{exact:true}).count(),0);
 await page.getByLabel('Search members',{exact:true}).fill('student');assert.equal(await page.getByLabel('Search members',{exact:true}).inputValue(),'student');
 await page.getByRole('button',{name:'Revoke access',exact:true}).click();await page.getByRole('alertdialog').waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal(calls.some(c=>c.path.endsWith('/revoke')),false,'cancel must not revoke access');
 await page.screenshot({path:path.join(output,'members-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.screenshot({path:path.join(output,'members-mobile-dark.png'),fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'workspace must fit mobile width');
 role='student';calls=[];await page.reload();await page.getByText('Your role cannot view institute member records.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Create invitation'}).count(),0);assert.equal(calls.some(c=>c.path.endsWith('/members')),false);
 assert.deepEqual(errors,[]);console.log('PASS: institute navigation, invitation, cancel, mobile width, role menus and console checks');
 }finally{await browser?.close();server?.kill('SIGTERM');}})().catch(e=>{console.error(e);process.exitCode=1;});
