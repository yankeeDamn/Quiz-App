'use strict';
const crypto = require('node:crypto');
const fail = (message, statusCode = 400) => Object.assign(new Error(message), {statusCode});
const permissions = Object.freeze({
 owner: ['workspace:read','settings:write','members:read','members:invite','members:revoke','staff:admin','banks:write','questions:write','questions:review','batches:write','exams:write','exams:publish','reports:read','billing:read'],
 admin: ['workspace:read','members:read','members:invite','members:revoke','banks:write','questions:write','questions:review','batches:write','exams:write','exams:publish','reports:read'],
 teacher: ['workspace:read','banks:write','questions:write','exams:write','assigned:reports'],
 student: ['workspace:read','assigned:take','own:results'],
});
function can(role, permission) { return Object.hasOwn(permissions,role) && permissions[role].includes(permission); }
function requirePermission(role, permission) { if (!can(role,permission)) throw fail('Permission denied',403); }
function text(value, max, min = 1) {
 if(typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw fail('Invalid text field');
 return value.trim();
}
function slug(value) { if(typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(value)) throw fail('Invalid institute slug'); return value; }
function uuid(value) { if(typeof value !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value)) throw fail('Invalid resource ID'); return value; }
function email(value) { const e=text(value,254).toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw fail('Invalid email'); return e; }
function secret() { const key=process.env.INSTITUTE_INVITATION_SECRET; if(!key || key.length<32) throw fail('Institute invitations are not configured',503); return key; }
function signInvite(id, expires) {
 const payload=Buffer.from(JSON.stringify({id,exp:Math.floor(expires/1000),aud:'exampro-institute-invite-v1'})).toString('base64url');
 return payload+'.'+crypto.createHmac('sha256',secret()).update(payload).digest('base64url');
}
function verifyInvite(token) {
 if(typeof token!=='string' || token.length>1024) throw fail('Invalid invitation',400);
 const parts=token.split('.'); if(parts.length!==2) throw fail('Invalid invitation',400);
 const expected=crypto.createHmac('sha256',secret()).update(parts[0]).digest('base64url');
 const supplied=Buffer.from(parts[1]);
 if(supplied.length!==expected.length || !crypto.timingSafeEqual(supplied,Buffer.from(expected))) throw fail('Invalid invitation',400);
 let data; try { data=JSON.parse(Buffer.from(parts[0],'base64url').toString()); } catch { throw fail('Invalid invitation'); }
 if(data.aud!=='exampro-institute-invite-v1' || !Number.isInteger(data.exp) || data.exp*1000<=Date.now()) throw fail('Invitation expired or invalid',410);
 uuid(data.id); return data;
}
const digest = token => crypto.createHash('sha256').update(token).digest('hex');
function profile(raw) {
 const p={tagline:text(raw.tagline||'',160,0),contactEmail:raw.contactEmail?email(raw.contactEmail):'',accentColor:raw.accentColor||'#1949c7',logo:raw.logo||''};
 if(!/^#[a-f0-9]{6}$/i.test(p.accentColor)) throw fail('Use a six-digit hex colour');
 // Raster data URI only. No remote fetch, SVG, arbitrary HTML or private contact defaults.
 if(typeof p.logo!=='string' || p.logo.length>100000 || (p.logo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.logo))) throw fail('Use a PNG, JPEG or WebP logo under 75 KB');
 return p;
}
module.exports={fail,permissions,can,requirePermission,text,slug,uuid,email,signInvite,verifyInvite,digest,profile};
