export type IndiaQuestion = { id: string; question: string; options: string[]; answer: number; explanation: string };
export type IndiaExam = { id: string; category: string; subject: string; title: string; questions: IndiaQuestion[] };
const rows: Array<[string,string,string,string[],number,string]> = [
 ['ssc','Quantitative Aptitude','What is 15% of 240?',['24','36','42','48'],1,'15/100 × 240 = 36'],
 ['ssc','Reasoning','What comes next: 2, 4, 8, 16, ?',['18','24','30','32'],3,'Each number doubles.'],
 ['ssc','English','Choose the correctly spelled word.',['Accomodate','Acommodate','Accommodate','Acomodate'],2,'Accommodate uses double c and double m.'],
 ['banking','Quantitative Aptitude','Simple interest on ₹1,000 at 5% for 2 years?',['₹50','₹100','₹150','₹200'],1,'P × R × T / 100 = ₹100.'],
 ['banking','Reasoning','Find the odd one out.',['4','9','16','20'],3,'20 is not a perfect square.'],
 ['banking','English','Which is a synonym of rapid?',['Slow','Quick','Late','Weak'],1,'Rapid means quick.'],
 ['railway','Mathematics','Square root of 144?',['10','11','12','14'],2,'12 × 12 = 144.'],
 ['railway','Reasoning','Complete 3, 6, 9, 12, ?',['13','14','15','18'],2,'Add 3 each time.'],
 ['railway','General Science','Chemical symbol for sodium?',['S','Na','So','N'],1,'Sodium is Na.'],
 ['upsc','Polity','Fundamental Rights are in which part of the Indian Constitution?',['II','III','IV','V'],1,'Part III contains Fundamental Rights.'],
 ['upsc','History','Who founded the Maurya Empire?',['Ashoka','Chandragupta Maurya','Harsha','Akbar'],1,'Chandragupta Maurya founded it.'],
 ['upsc','Geography','Which latitude is zero degrees?',['Tropic of Cancer','Equator','Arctic Circle','Prime Meridian'],1,'The Equator is 0° latitude.'],
 ['jee','Physics','What is the SI unit of force?',['Joule','Watt','Newton','Pascal'],2,'Force is measured in newtons.'],
 ['jee','Chemistry','What is the atomic number of oxygen?',['6','7','8','9'],2,'Oxygen has 8 protons.'],
 ['jee','Mathematics','What is the derivative of x²?',['x','2x','x³','2'],1,'The power rule gives 2x.'],
 ['neet','Physics','What is the SI unit of electric current?',['Volt','Ampere','Ohm','Coulomb'],1,'Current is measured in amperes.'],
 ['neet','Chemistry','What is the pH of pure water at 25°C?',['5','6','7','9'],2,'Neutral water has pH 7.'],
 ['neet','Biology','Which organelle makes most ATP during aerobic respiration?',['Ribosome','Mitochondrion','Nucleus','Golgi apparatus'],1,'Mitochondria produce most ATP.'],
 ['school','Mathematics','What is 7 × 8?',['54','56','58','64'],1,'7 × 8 = 56.'],
 ['school','Science','Which gas do plants use in photosynthesis?',['Oxygen','Nitrogen','Carbon dioxide','Hydrogen'],2,'Plants absorb carbon dioxide.'],
 ['school','English','Which word is a noun?',['Quickly','Beautiful','Teacher','Run'],2,'Teacher is a noun.'],
 ['it','Cloud','What does IaaS stand for?',['Infrastructure as a Service','Internet as a Service','Identity as a Service','Integration as a System'],0,'IaaS provides on-demand infrastructure.'],
 ['it','Networking','Which protocol secures web browsing?',['FTP','HTTP','HTTPS','SMTP'],2,'HTTPS uses TLS.'],
 ['it','Cybersecurity','Which adds a second verification factor?',['Caching','MFA','Compression','Port forwarding'],1,'MFA uses more than one factor.']
];
const names: Record<string,string> = {ssc:'SSC CGL / CHSL',banking:'Banking / IBPS',railway:'Railway / RRB',upsc:'UPSC / State PSC',jee:'JEE Main',neet:'NEET UG',school:'CBSE / ICSE',it:'IT Certifications'};
export const indiaExams: IndiaExam[] = Object.entries(names).map(([id,category])=>({
 id,category,subject:'Mixed Practice',title:`${category} Starter Mock`,
 questions:rows.filter(row=>row[0]===id).map((row,i)=>({id:`${id}-${i+1}`,question:row[2],options:row[3],answer:row[4],explanation:row[5]}))
}));
