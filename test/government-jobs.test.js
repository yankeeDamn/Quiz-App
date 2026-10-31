'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const service=require('../src/services/government-jobs.service');
const now=new Date('2026-10-31T12:00:00.000Z');
const employment=[
 '<html><body><table>',
 '<tr><th>Issued Date</th><th>Organisation</th><th>Post</th><th>Method of Appointment</th><th>Last Date</th></tr>',
 '<tr><td>10/20/2026</td><td>DEPARTMENT OF TESTING</td><td>Junior Examiner</td><td>Recruitment</td><td>15/11/2026</td></tr>',
 '<tr><td>10/20/2026</td><td>DEPARTMENT OF TESTING</td><td>Junior Examiner</td><td>Recruitment</td><td>15/11/2026</td></tr>',
 '<tr><td>10/20/2026</td><td>NATIONAL LABORATORY</td><td>Research Assistant</td><td>Recruitment</td><td>30/10/2026</td></tr>',
 '<tr><td>10/20/2026</td><td>UNOPENED VACANCY</td><td>Clerk</td><td>Recruitment</td><td>31/02/2027</td></tr>',
 '<tr><td>10/31/2026</td><td>UNIVERSITY</td><td>Assistant Professor</td><td>Recruitment</td><td>31/10/2026</td></tr>',
 '<tr><td>10/20/2026</td><td>UNTRUSTED</td><td><script>alert(1)</script>Officer</td><td>Recruitment</td><td>15/11/2026</td></tr>',
 '</table></body></html>'].join('');
test('Employment News rows use official date columns, hide expired and reject impossible deadlines',()=>{
 const list=service.parseEmployment(employment,now);
 assert.equal(list.length,3);
 assert.ok(list.every(x=>x.applicationDeadline>='2026-10-31'));
 assert.ok(list.every(x=>x.sourceUrl.startsWith('https://employmentnews.gov.in/')));
 assert.ok(list.every(x=>x.applicationUrl===null));
 assert.ok(list.some(x=>x.applicationDeadline==='2026-10-31'));
 assert.ok(list.every(x=>!x.title.includes('<script>')));
 assert.ok(list.some(x=>x.title==='Officer'));
});
test('provided dates are validated as actual calendar days',()=>{
 assert.equal(service.parseDate('31/02/2027'),null);
 assert.equal(service.parseDate('31/10/2026'),'2026-10-31');
 assert.equal(service.parseDate('10/31/2026',true),'2026-10-31');
 assert.equal(service.parseDate('bad'),null);
});
test('UPSC forthcoming notices are marked upcoming without invented application dates',()=>{
 const html='<html><h2>Forthcoming Examinations</h2><h3>Combined Defence Services Examination (I), 2027</h3><p>Yet to be notified</p><h3>National Defence Academy and Naval Academy Examination (I), 2027</h3><h2>Annual Calendar Documents</h2><h3>Do not include Examination 2030</h3></html>';
 const jobs=service.parseUpcomingUpsc(html);
 assert.equal(jobs.length,2);
 assert.ok(jobs.every(j=>j.status==='upcoming'&&j.applicationDeadline===null&&j.applicationUrl===null));
});
test('source HTML normalizes to plain text, not markup',()=>{
 assert.equal(service.plain('<span>Bank &amp; Finance</span><script>steal()</script>'),'Bank & Finance');
});
test('official portal links are fixed HTTPS destinations and require no private account',()=>{
 assert.ok(service.PORTALS.length>=5);
 assert.ok(service.PORTALS.every(x=>x.url.startsWith('https://')));
 const route=fs.readFileSync(path.join(__dirname,'../src/routes/government-jobs.js'),'utf8');
 assert.match(route,/router\.get\('\/'/);
 assert.doesNotMatch(route,/authenticateNextAuth|requireAdmin|adminKey/);
 const index=fs.readFileSync(path.join(__dirname,'../src/routes/index.js'),'utf8');
 assert.match(index,/router\.use\('\/government-jobs'/);
});

const upscFixture='<h2>Forthcoming Examinations</h2><h3>Example Civil Services Examination, 2027</h3><h2>Annual Calendar Documents</h2>';
const response=(body,status=200,headers={})=>new Response(body,{status,headers:{'Content-Type':'text/html',...headers}});
const expiredEmployment=employment.replaceAll('15/11/2026','30/10/2026').replaceAll('31/10/2026</td>','30/10/2026</td>');

test('Employment News accepts a valid deadline when the issue column contradicts its date format',()=>{
 const html=employment.replaceAll('10/20/2026','24/10/2026');
 const jobs=service.parseEmployment(html,now);
 assert.ok(jobs.some(job=>job.title==='Junior Examiner'&&job.noticeDate==='2026-10-24'));
 const ambiguous=service.parseEmployment(employment.replaceAll('10/20/2026','09/10/2026'),now);
 assert.ok(ambiguous.some(job=>job.title==='Junior Examiner'&&job.noticeDate===null));
});

test('UPSC extraction starts at the actual heading even after a large navigation menu',()=>{
 const html='<nav>Forthcoming Examinations'+' '.repeat(50000)+'</nav>'+upscFixture;
 assert.equal(service.parseUpcomingUpsc(html).length,1);
 assert.equal(service.parseUpcomingUpsc('<nav>Forthcoming Examinations</nav><h3>Unrelated Examination, 2027</h3>').length,0);
});

test('a source with valid expired rows is a healthy empty result, cached for thirty minutes',async()=>{
 let requests=0,time=now.getTime();
 const index=service.createJobsService({clock:()=>time,fetchImpl:async(url)=>{requests++;return response(url.includes('employmentnews')?expiredEmployment:upscFixture);}});
 const first=await index.list();
 assert.equal(first.sources[0].status,'ok');
 assert.match(first.sources[0].message,/deadlines have passed/);
 assert.equal(first.jobs.filter(job=>job.status==='open').length,0);
 assert.equal(first.jobs.filter(job=>job.status==='upcoming').length,1);
 time+=29*60*1000;
 await index.list();
 assert.equal(requests,2);
 time+=2*60*1000;
 await index.list();
 assert.equal(requests,4);
});

test('a blocked or changed page is unavailable, never a healthy empty result',async()=>{
 const index=service.createJobsService({clock:()=>now.getTime(),fetchImpl:async()=>response('<html>Access denied</html>')});
 const result=await index.list();
 assert.equal(result.jobs.length,0);
 assert.ok(result.sources.every(source=>source.status==='unavailable'&&source.checkedAt===null));
 assert.ok(result.sources.every(source=>source.lastAttemptAt===now.toISOString()));
 assert.ok(result.sources.every(source=>/could not be read reliably/.test(source.message)));
});

test('UPSC falls back to its pinned official homepage when the calendar returns 503',async()=>{
 const requests=[];
 const index=service.createJobsService({clock:()=>now.getTime(),fetchImpl:async(url)=>{
  requests.push(url);
  if(url.includes('employmentnews'))return response(expiredEmployment);
  return url.includes('examination-calendar')?response('Unavailable',503):response(upscFixture);
 }});
 const result=await index.list();
 assert.equal(result.sources[1].status,'ok');
 assert.equal(result.jobs[0].sourceUrl,'https://cms.upsc.gov.in/');
 assert.ok(requests.includes('https://cms.upsc.gov.in/'));
});

test('failures retain bounded stale data, throttle retries and eventually drop old notices',async()=>{
 let time=now.getTime(),failing=false,requests=0;
 const index=service.createJobsService({clock:()=>time,fetchImpl:async(url)=>{
  requests++;
  return failing?response('Unavailable',503):response(url.includes('employmentnews')?employment:upscFixture);
 }});
 const first=await index.list();
 const checkedAt=first.sources[0].checkedAt;
 time+=31*60*1000;failing=true;
 const stale=await index.list();
 assert.ok(stale.sources.every(source=>source.status==='stale'));
 assert.equal(stale.sources[0].checkedAt,checkedAt);
 assert.ok(stale.jobs.length>0);
 const count=requests;
 await index.list();
 assert.equal(requests,count,'failed requests are throttled for five minutes');
 time+=6*60*60*1000;
 const expired=await index.list();
 assert.ok(expired.sources.every(source=>source.status==='unavailable'));
 assert.equal(expired.jobs.length,0);
});

test('deadlines are re-filtered at India midnight even while cached',async()=>{
 let time=Date.parse('2026-10-31T18:29:00Z');
 const index=service.createJobsService({clock:()=>time,fetchImpl:async(url)=>response(url.includes('employmentnews')?employment:upscFixture)});
 assert.ok((await index.list()).jobs.some(job=>job.applicationDeadline==='2026-10-31'));
 time+=2*60*1000;
 assert.ok((await index.list()).jobs.every(job=>job.applicationDeadline!=='2026-10-31'));
 assert.equal(service.indiaToday(new Date(time)),'2026-11-01');
});

test('concurrent visitors share one in-flight refresh per source',async()=>{
 let requests=0,release;
 const wait=new Promise(resolve=>{release=resolve;});
 const index=service.createJobsService({clock:()=>now.getTime(),fetchImpl:async(url)=>{requests++;await wait;return response(url.includes('employmentnews')?employment:upscFixture);}});
 const first=index.list(),second=index.list();
 release();
 await Promise.all([first,second]);
 assert.equal(requests,2);
});

test('off-domain redirects are rejected before contacting their destination',async()=>{
 const requests=[];
 const index=service.createJobsService({clock:()=>now.getTime(),fetchImpl:async(url)=>{
  requests.push(url);
  return response('',302,{location:'https://untrusted.example/private'});
 }});
 const result=await index.list();
 assert.ok(result.sources.every(source=>source.status==='unavailable'));
 assert.ok(result.sources.every(source=>/approved domain/.test(source.message)));
 assert.ok(requests.every(url=>!url.includes('untrusted.example')));
});

test('oversized official pages are rejected with a source health reason',async()=>{
 const index=service.createJobsService({clock:()=>now.getTime(),fetchImpl:async()=>response('x'.repeat(1024*1024+1))});
 const result=await index.list();
 assert.ok(result.sources.every(source=>source.status==='unavailable'));
 assert.ok(result.sources.every(source=>/size limit/.test(source.message)));
});
