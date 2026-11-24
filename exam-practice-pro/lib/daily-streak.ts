export type DailyLanguage = 'en' | 'hi' | 'bn';
export type DailyQuestion = {
  id: string;
  topic: string;
  question: Record<DailyLanguage, string>;
  options: Record<DailyLanguage, string[]>;
  correctIndex: number;
  explanation: Record<DailyLanguage, string>;
};

export type DailyStreakState = {
  currentStreak: number;
  bestStreak: number;
  lastCompletedDate: string | null;
  todayScore: number | null;
  todayTimeSeconds: number | null;
  todayAnswers: number[];
  completedDates: string[];
  streakFreezesRemaining: number;
};

const BANK: DailyQuestion[] = [
  { id: 'polity-1', topic: 'Polity', question: { en: 'Which part of the Indian Constitution contains the Fundamental Rights?', hi: 'भारतीय संविधान के किस भाग में मौलिक अधिकार हैं?', bn: 'ভারতীয় সংবিধানের কোন অংশে মৌলিক অধিকার রয়েছে?' }, options: { en: ['Part I', 'Part II', 'Part III', 'Part IV'], hi: ['भाग I', 'भाग II', 'भाग III', 'भाग IV'], bn: ['প্রথম ভাগ', 'দ্বিতীয় ভাগ', 'তৃতীয় ভাগ', 'চতুর্থ ভাগ'] }, correctIndex: 2, explanation: { en: 'Fundamental Rights are contained in Part III (Articles 12–35).', hi: 'मौलिक अधिकार भाग III (अनुच्छेद 12–35) में हैं।', bn: 'মৌলিক অধিকার তৃতীয় ভাগে (অনুচ্ছেদ ১২–৩৫) রয়েছে।' } },
  { id: 'quant-1', topic: 'Quant', question: { en: 'What is 15% of 200?', hi: '200 का 15% कितना है?', bn: '200-এর 15% কত?' }, options: { en: ['15', '20', '30', '35'], hi: ['15', '20', '30', '35'], bn: ['15', '20', '30', '35'] }, correctIndex: 2, explanation: { en: '10% of 200 is 20 and 5% is 10, so 15% is 30.', hi: '200 का 10% = 20 और 5% = 10, इसलिए 15% = 30।', bn: '200-এর 10% = 20 এবং 5% = 10, তাই 15% = 30।' } },
  { id: 'science-1', topic: 'Science', question: { en: 'Which gas do plants absorb during photosynthesis?', hi: 'प्रकाश संश्लेषण के दौरान पौधे कौन-सी गैस लेते हैं?', bn: 'সালোকসংশ্লেষের সময় উদ্ভিদ কোন গ্যাস গ্রহণ করে?' }, options: { en: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], hi: ['ऑक्सीजन', 'नाइट्रोजन', 'कार्बन डाइऑक्साइड', 'हाइड्रोजन'], bn: ['অক্সিজেন', 'নাইট্রোজেন', 'কার্বন ডাই-অক্সাইড', 'হাইড্রোজেন'] }, correctIndex: 2, explanation: { en: 'Plants use carbon dioxide, water and light to make sugars.', hi: 'पौधे शर्करा बनाने के लिए कार्बन डाइऑक्साइड, पानी और प्रकाश का उपयोग करते हैं।', bn: 'উদ্ভিদ শর্করা তৈরিতে কার্বন ডাই-অক্সাইড, জল ও আলো ব্যবহার করে।' } },
  { id: 'reasoning-1', topic: 'Reasoning', question: { en: 'Complete the series: 2, 4, 8, 16, __', hi: 'श्रृंखला पूरी करें: 2, 4, 8, 16, __', bn: 'ধারাটি সম্পূর্ণ করুন: 2, 4, 8, 16, __' }, options: { en: ['18', '24', '30', '32'], hi: ['18', '24', '30', '32'], bn: ['18', '24', '30', '32'] }, correctIndex: 3, explanation: { en: 'Each number doubles, so the next number is 32.', hi: 'हर संख्या दोगुनी है, इसलिए अगली संख्या 32 है।', bn: 'প্রতিটি সংখ্যা দ্বিগুণ হচ্ছে, তাই পরের সংখ্যা 32।' } },
  { id: 'computer-1', topic: 'Computer & AI', question: { en: 'Which Python keyword defines a function?', hi: 'Python में फ़ंक्शन बनाने के लिए कौन-सा कीवर्ड है?', bn: 'Python-এ ফাংশন সংজ্ঞায়িত করতে কোন keyword ব্যবহৃত হয়?' }, options: { en: ['func', 'def', 'function', 'lambda'], hi: ['func', 'def', 'function', 'lambda'], bn: ['func', 'def', 'function', 'lambda'] }, correctIndex: 1, explanation: { en: 'The def keyword defines a named function in Python.', hi: 'Python में def कीवर्ड नाम वाला फ़ंक्शन बनाता है।', bn: 'Python-এ def keyword দিয়ে named function তৈরি হয়।' } },
];

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDailyQuestions(dateStr = getLocalDateKey()): DailyQuestion[] {
  let seed = 0;
  for (const char of dateStr) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  return BANK.map((_, index) => ({ question: BANK[(index + seed + index * 7) % BANK.length], index })).sort((a, b) => a.index - b.index).map((item) => item.question);
}

export function emptyStreakState(): DailyStreakState {
  return { currentStreak: 0, bestStreak: 0, lastCompletedDate: null, todayScore: null, todayTimeSeconds: null, todayAnswers: [], completedDates: [], streakFreezesRemaining: 1 };
}

export function loadStreakState(): DailyStreakState {
  if (typeof window === 'undefined') return emptyStreakState();
  try {
    const parsed = JSON.parse(window.localStorage.getItem('exampro-daily-streak-v1') || 'null') as Partial<DailyStreakState> | null;
    return { ...emptyStreakState(), ...parsed };
  } catch { return emptyStreakState(); }
}

export function saveStreakState(state: DailyStreakState): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem('exampro-daily-streak-v1', JSON.stringify(state)); } catch { /* Private browsing may block storage. */ }
}

export function calculateCompletion(previous: DailyStreakState, score: number, seconds: number, answers: number[], date = getLocalDateKey()): DailyStreakState {
  if (previous.lastCompletedDate === date) return { ...previous, todayScore: score, todayTimeSeconds: seconds, todayAnswers: answers };
  const yesterdayDate = new Date(`${date}T12:00:00`);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getLocalDateKey(yesterdayDate);
  let currentStreak = previous.currentStreak;
  let freezes = previous.streakFreezesRemaining;
  if (!previous.lastCompletedDate) currentStreak = 1;
  else if (previous.lastCompletedDate === yesterday) currentStreak += 1;
  else if (freezes > 0) { freezes -= 1; currentStreak = Math.max(1, currentStreak); }
  else currentStreak = 1;
  const completedDates = [...new Set([...previous.completedDates, date])].sort().slice(-30);
  return { currentStreak, bestStreak: Math.max(previous.bestStreak, currentStreak), lastCompletedDate: date, todayScore: score, todayTimeSeconds: seconds, todayAnswers: answers, completedDates, streakFreezesRemaining: freezes };
}
