'use strict';

/**
 * Stable protection for official-pattern SSC CGL full-length mocks.
 *
 * Do NOT use name matching alone: an admin can rename a mock while it
 * remains the same 100-question exam, which would bypass review gates.
 */
function isFullCglMock(definition) {
  if (!definition || typeof definition !== 'object') return false;
  const id=String(definition.id||'');
  if (/^ssc-cgl-20\d{2}-mock-\d+$/i.test(id)) return true;

  const exam=String(definition.exam||'');
  const name=String(definition.name||'');
  if (!/ssc/i.test(exam) || !/cgl/i.test(name)) return false;
  if (/\bfull\s+mock\b/i.test(name)) return true;

  const sections=definition.sections;
  return Array.isArray(sections) && sections.length===4 &&
    sections.reduce((n,section)=>n+(Array.isArray(section?.parts)
      ?section.parts.reduce((m,p)=>m+(Number(p.to)-Number(p.from)),0):0),0)>=100;
}
module.exports={isFullCglMock};
