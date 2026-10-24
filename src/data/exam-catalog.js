'use strict';

// Curated starter questions. Expand with reviewed/licensed content before production use.
const categories = [
  { id: 'ssc', name: 'SSC CGL / CHSL', subjects: ['Quantitative Aptitude', 'Reasoning', 'English', 'General Awareness'] },
  { id: 'banking', name: 'Banking / IBPS', subjects: ['Quantitative Aptitude', 'Reasoning', 'English', 'Banking Awareness'] },
  { id: 'railway', name: 'Railway / RRB', subjects: ['Mathematics', 'Reasoning', 'General Science'] },
  { id: 'upsc', name: 'UPSC / State PSC', subjects: ['Polity', 'History', 'Geography', 'Economy'] },
  { id: 'jee', name: 'JEE Main', subjects: ['Physics', 'Chemistry', 'Mathematics'] },
  { id: 'neet', name: 'NEET UG', subjects: ['Physics', 'Chemistry', 'Biology'] },
  { id: 'school', name: 'CBSE / ICSE', subjects: ['Mathematics', 'Science', 'English'] },
  { id: 'it', name: 'IT Certifications', subjects: ['Cloud', 'Networking', 'Cybersecurity'] }
];
const questions = [
  ['ssc','Quantitative Aptitude','What is 15% of 240?',['24','36','42','48'],1,'0.15 × 240 = 36.'],
  ['ssc','Reasoning','What comes next: 2, 4, 8, 16, ?',['18','24','30','32'],3,'Each term doubles.'],
  ['ssc','English','Choose the correctly spelled word.',['Accomodate','Acommodate','Accommodate','Acomodate'],2,'Accommodate has double c and double m.'],
  ['ssc','General Awareness','Which is the largest planet in the Solar System?',['Earth','Saturn','Jupiter','Neptune'],2,'Jupiter is the largest planet.'],
  ['banking','Quantitative Aptitude','Simple interest on ₹1,000 at 5% per annum for 2 years is?',['₹50','₹100','₹150','₹200'],1,'SI = P × R × T / 100 = ₹100.'],
  ['banking','Reasoning','Which number is the odd one out?',['4','9','16','20'],3,'4, 9 and 16 are perfect squares.'],
  ['banking','English','Choose the synonym of rapid.',['Slow','Quick','Late','Weak'],1,'Rapid means quick.'],
  ['banking','Banking Awareness','What does RBI stand for?',['Reserve Bank of India','Regional Bank of India','Retail Bank of India','Revenue Bank of India'],0,'RBI stands for Reserve Bank of India.'],
  ['railway','Mathematics','What is the square root of 144?',['10','11','12','14'],2,'12 × 12 = 144.'],
  ['railway','Reasoning','Complete the series: 3, 6, 9, 12, ?',['13','14','15','18'],2,'The series increases by 3.'],
  ['railway','General Science','What is the chemical symbol for sodium?',['S','Na','So','N'],1,'Sodium has the symbol Na.'],
  ['upsc','Polity','Which part of the Indian Constitution contains Fundamental Rights?',['Part II','Part III','Part IV','Part V'],1,'Fundamental Rights are in Part III.'],
  ['upsc','History','Who founded the Maurya Empire?',['Ashoka','Chandragupta Maurya','Harsha','Akbar'],1,'Chandragupta Maurya founded the Maurya Empire.'],
  ['upsc','Geography','Which latitude is 0 degrees?',['Tropic of Cancer','Equator','Arctic Circle','Prime Meridian'],1,'The Equator is 0° latitude.'],
  ['upsc','Economy','What does GDP stand for?',['Gross Domestic Product','General Domestic Price','Gross Development Plan','General Demand Product'],0,'GDP stands for Gross Domestic Product.'],
  ['jee','Physics','SI unit of force is?',['Joule','Watt','Newton','Pascal'],2,'Force is measured in newtons.'],
  ['jee','Chemistry','Atomic number of oxygen is?',['6','7','8','9'],2,'Oxygen has 8 protons.'],
  ['jee','Mathematics','Derivative of x² with respect to x is?',['x','2x','x³','2'],1,'The power rule gives 2x.'],
  ['neet','Physics','SI unit of electric current is?',['Volt','Ampere','Ohm','Coulomb'],1,'Electric current is measured in amperes.'],
  ['neet','Chemistry','pH of pure water at 25°C is approximately?',['5','6','7','9'],2,'Pure water is neutral at pH 7 at 25°C.'],
  ['neet','Biology','Which organelle produces most ATP during aerobic respiration?',['Ribosome','Mitochondrion','Nucleus','Golgi apparatus'],1,'Mitochondria generate most ATP in aerobic respiration.'],
  ['school','Mathematics','What is 7 × 8?',['54','56','58','64'],1,'7 multiplied by 8 is 56.'],
  ['school','Science','Plants absorb which gas during photosynthesis?',['Oxygen','Nitrogen','Carbon dioxide','Hydrogen'],2,'Plants use carbon dioxide in photosynthesis.'],
  ['school','English','Which word is a noun?',['Quickly','Beautiful','Teacher','Run'],2,'Teacher names a person.'],
  ['it','Cloud','What does IaaS stand for?',['Infrastructure as a Service','Internet as a Service','Identity as a Service','Integration as a System'],0,'IaaS provides infrastructure resources on demand.'],
  ['it','Networking','Which protocol is commonly used for secure web browsing?',['FTP','HTTP','HTTPS','SMTP'],2,'HTTPS encrypts web traffic using TLS.'],
  ['it','Cybersecurity','Which practice adds a second verification factor to login?',['Caching','MFA','Compression','Port forwarding'],1,'Multi-factor authentication uses multiple factors.']
].map(([categoryId,subject,prompt,options,answerIndex,explanation],i)=>({
 id:`starter-${String(i+1).padStart(3,'0')}`,categoryId,subject,prompt,options,answerIndex,explanation,difficulty:'easy'
}));
module.exports = { categories, questions };
