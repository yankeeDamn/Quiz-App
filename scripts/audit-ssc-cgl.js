#!/usr/bin/env node
'use strict';
/**
 * Read-only SSC CGL Tier-I content audit. Never publishes mocks or edits Neon.
 * With DATABASE_URL it checks the live DB; without it checks bundled starter data.
 * The audit uses an explicit release checklist rather than counting draft practice sets as full mocks.
 *
 * Usage: node scripts/audit-ssc-cgl.js
 */
const mocks = require('../src/services/mocks.service');
const database = require('../src/config/database');
const SECTION_NAMES = [
  /reason/i,
  /general awareness|general knowledge|gs|gk/i,
  /quant|math|aptitude/i,
  /english/i,
];
const REQUIRED_COUNT = 100;
function auditBank(bank) {
  const definitions = mocks.allDefinitions(bank)
    .filter(d => d.kind === 'mock' && d.exam === 'SSC' && /cgl/i.test(d.name));
  const all = new Map();
  const results = definitions.map(d => {
    const test = mocks.build(bank, d);
    const failures = [];
    if (test.questions.length !== REQUIRED_COUNT) failures.push('Expected exactly 100 questions');
    if (test.sections.length !== 4) failures.push('Expected four Tier-I sections');
    else SECTION_NAMES.forEach((pattern, i) => {
      const section = test.sections[i];
      if (!pattern.test(section.name)) failures.push('Section ' + (i + 1) + ' has unexpected topic: ' + section.name);
      if (section.to - section.from !== 25) failures.push('Section ' + (i + 1) + ' must contain 25 questions');
    });
    if (d.minutes !== 60) failures.push('Tier-I standard duration must be 60 minutes (review sectional timing requirements)');
    if (Number(d.marksPerCorrect) !== 2 || Number(d.negativeMarks) !== .5) failures.push('Expected +2 / -0.50 marking');
    const local = new Set();
    for (const q of test.questions) {
      const stem = String(q.question || '').trim().toLowerCase().replace(/\s+/g,' ');
      if (stem.length < 20) failures.push('Question has short or empty stem: ' + q.id);
      if (local.has(stem)) failures.push('Repeated question inside mock: ' + q.id);
      local.add(stem);
      if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some(v => !String(v).trim())) failures.push('Invalid options: ' + q.id);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) failures.push('Invalid answer key: ' + q.id);
      if (String(q.explanation || '').trim().length < 25) failures.push('Explanation too short for editorial review: ' + q.id);
      const used = all.get(stem) || [];
      used.push(d.id);
      all.set(stem,used);
    }
    return {id:d.id,name:d.name,active:d.active!==false,tier:d.tier,questions:test.questions.length,issues:[...new Set(failures)]};
  });
  // A question used in multiple purported full mocks undermines independent practice.
  for (const r of results) {
    const duplicated=[...all.values()].filter(ids=>ids.includes(r.id)&&new Set(ids).size>1).length;
    if (duplicated) r.issues.push(duplicated+' questions reused across SSC CGL mocks');
  }
  const ready=results.filter(r=>r.active&&r.issues.length===0);
  return {target:10,ready:ready.length,totalCglCandidates:results.length,results,passes:ready.length>=10};
}
if (require.main === module) (async()=>{
 const bank=await mocks.loadBank();
 const report=auditBank(bank);
 console.log(JSON.stringify(report,null,2));
 if(!report.passes)process.exitCode=1;
})().catch(error=>{console.error('Could not audit mock bank:',error.message);process.exitCode=2;})
.finally(async()=>{await database.end()});
module.exports={auditBank};
