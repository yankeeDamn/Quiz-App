'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('header uses shared language state and translated labels for desktop/mobile navigation',()=>{
 const root=path.resolve(__dirname,'../exam-practice-pro/components');
 const lang=fs.readFileSync(path.join(root,'exampro/exam-language.tsx'),'utf8');
 const header=fs.readFileSync(path.join(root,'layout/header.tsx'),'utf8');
 const keys=['quizzes','certifications','indiaMocks','examHall','dashboard','institutes','bookmarks','pricing','signIn','signOut','explore','learningSpace'];
 for(const key of keys){
  const occurrences=lang.match(new RegExp('\\b'+key+':','g'))||[];
  assert.equal(occurrences.length,3,'Translations for all three languages: '+key);
  assert.match(header,new RegExp('t\\(\x27'+key+'\x27\\)'),'Navigation uses translated key '+key);
 }
 assert.match(header,/useExamLanguage\(\)/,'Header subscribes to shared switcher');
 assert.match(header,/<nav lang=\{language\}/,'Navigation has appropriate locale metadata');
 assert.match(header,/\{t\(label\)\}/,'Mobile menu entries are translated');
});
