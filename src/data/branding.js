'use strict';
const defaultBranding = Object.freeze({
 instituteName: 'Exam Practice Pro', tagline: 'Prepare smarter. Achieve more.',
 primaryColor: '#2563eb', secondaryColor: '#0f172a',
 logoUrl: null, bannerUrl: null, supportEmail: null, supportPhone: null
});
function publicBranding(input = {}) {
 const safe = {};
 for (const key of Object.keys(defaultBranding)) {
   const value = input[key];
   safe[key] = typeof value === 'string' && value.length <= 200 ? value : defaultBranding[key];
 }
 return safe;
}
module.exports = { defaultBranding, publicBranding };
