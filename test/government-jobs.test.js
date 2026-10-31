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
