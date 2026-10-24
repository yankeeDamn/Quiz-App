'use strict';
const RESERVED = new Set(['www','api','admin','app','mail','support']);
function normalizeHostname(value) {
 if (typeof value !== 'string') return null;
 const host = value.trim().toLowerCase().replace(/\.$/,'').replace(/:\d+$/,'');
 if (!host || host.length > 253 || !/^[a-z0-9.-]+$/.test(host) || host.includes('..')) return null;
 return host;
}
function resolveTenantSlug(hostname, baseDomain) {
 const host=normalizeHostname(hostname), base=normalizeHostname(baseDomain);
 if (!host || !base || host===base || !host.endsWith('.'+base)) return null;
 const slug=host.slice(0,-base.length-1);
 if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || RESERVED.has(slug)) return null;
 return slug;
}
module.exports={ normalizeHostname, resolveTenantSlug };
