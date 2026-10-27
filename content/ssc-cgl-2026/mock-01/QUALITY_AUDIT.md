# Mock 01 · 100-item academic and technical QA audit

**Audit date:** 27 October 2026  
**Branch:** `feat/ssc-cgl-2026-mock-01-original-100-draft` · PR #45  
**Status:** AI desk-reviewed / **independent human approval still outstanding** · **DRAFT ONLY / NOT PUBLISHED**  

## Summary

- **100 of 100** questions individually checked against their keyed options and explanations (review trail below and `quality-review.json`).
- **20 questions materially edited**: 4 Reasoning, 6 General Awareness, 5 Quantitative Aptitude and 5 English. Issues comprised ambiguity, duplicated concepts, imprecise wording, or weak subject coverage. Corrected CSVs were regenerated from the canonical JSON.
- Each section retains **25** questions. Expected scoring remains **+2**, **−0.50**, total **200**. Correct option placement remains balanced **25 A / 25 B / 25 C / 25 D**.
- **Exact repeats:** None within the new 100 stems; no exact match in the 620 bundled historic question stems at the time of the audit. A broader semantic comparison found several substantially similar existing questions and they were replaced. Concepts such as percentages, grammar, algebra and ranking may still recur because they belong to the syllabus; automated checks cannot establish complete originality.
- This review tested mathematical calculations, grammar, logic, factual references and answer/explanation alignment. It is **not** external teacher validation, psychometric standardisation or a plagiarism clearance certificate.

## Verified official exam format

The [SSC CGL 2026 notification, §§13.8 and 13.10](https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf) states four 25-question sections, 50 marks each, 15 minutes per section (standard candidates), 20 minutes per section for candidates eligible for scribes, and −0.50 for incorrect answers. The notice says questions are in **English and Hindi except English Comprehension**. ExamPro's draft questions are presently authored in English only, so the official bilingual/accommodation requirement remains a release gate.

## Changes made during QA

| Section and item | Finding | Correction |
|---|---|---|
| Reasoning #12 | “Egg : Bird” left egg type implicit | Specifies *fertilised bird egg* and developmental relationship |
| Reasoning #17 | Repeated elementary ordering type | Replaced with 2×2 grid square-counting |
| Reasoning #22 | Coded operator evaluation could be read with original precedence | Explicit substitution followed by standard precedence |
| Reasoning #24 | Fourth numerical-series item added little breadth | Replaced with paper-folding hole-count problem |
| General Awareness #4 | Panchayati Raj amendment repeated an existing question | Changed to Seventh Schedule legislative lists |
| General Awareness #6 | Too many Constitution questions and little chemistry | Changed to chromium's passive oxide film |
| General Awareness #12 | Konark location repeated an existing question | Changed to Sattriya dance origin |
| General Awareness #16 | Two Odisha location questions, no recent science current affairs | Replaced with verified 2025 NASA–ISRO NISAR collaboration |
| General Awareness #22 | Ohm unit reproduced an existing bank fact | Changed to pure water pH at 25 °C |
| General Awareness #24 | RBI founding-year question substantially repeated existing bank | Changed to consumer price index meaning |
| Quantitative Aptitude #9 | Train crossing pole had same ratio/speed as bundled question | Changed to opposing trains and relative speed |
| Quantitative Aptitude #10 | 40/60 equal-distance average speed duplicated existing exercise | Replaced with upstream/downstream boat speed |
| Quantitative Aptitude #21 | Repeated worker-days topic; missing 3D mensuration | Replaced with right-cylinder volume |
| Quantitative Aptitude #22 | Acid dilution assumed volumes were additive without saying so | Added an explicit idealised-volume assumption |
| Quantitative Aptitude #24 | Basic linear equation instead of graph skill | Changed to finding a line's y-intercept |
| English #3 | 'Insisted on paying the bill' was nearly identical to existing bank | Replaced with 'objected to' grammar |
| English #14 | 'Effect' can itself be a verb; explanation oversimplified | Explicitly distinguishes *influence* from *bring about* |
| English #21 | 'Before dinner' left actual closing-time access unclear | Stated workers could rarely arrive before closing at 6 p.m. |
| English #24 | Soil 'required purchased fertiliser' made an uncertain causal claim | Reworded application by farmer and qualified inference |
| English #25 | Five isolated micro-passages; no sequencing skill | Replaced one with paragraph/jumble sequencing task |

## Syllabus breadth and remaining quality concerns

- **Reasoning:** includes coding, syllogisms, patterns, cube/square counting, paper folding, directions, ranking and relationships. **Still limited** in authentic illustrated non-verbal figures, Venn diagrams, embedded figures and complex visual memory; text substitutes do not fully reproduce visual SSC questions.
- **General Awareness:** covers polity, history, culture, geography, economy, biology, physics, chemistry and one dated science/current-affairs item (NISAR 2025). **Still underrepresents** sports, awards, multi-topic current affairs and several national/international 2026 events.
- **Quantitative Aptitude:** covers arithmetic, geometry, cylinder mensuration, trigonometry, boat speed, interest, percentages and linear graphs. **Still underrepresents** authentic data charts, partnership, graphical DI and complex heights/distances.
- **English:** tests grammar, voice, narration, vocabulary, concise comprehension and sentence ordering. **Still underrepresents** longer multi-question passages, cloze and full paragraph completion.
- Questions skew **easy to moderate**: no timed pilot discrimination data. Not a validated difficulty-equivalent SSC paper.
- Existing backend supports standard 15-minute SSC sectional timing only when a qualifying test is activated. 20-minute eligible-scribe timing and approved accommodations require separate review and implementation.
- **Translation:** SSC instructions specify bilingual items in Parts A–C. The English-language authoring file is not yet an independently proofread Hindi translation.

## Important fact-check references

- [Official 2026 SSC CGL notice](https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf), §§13.8, 13.10 (exam scheme and indicative syllabus).
- [NASA NISAR mission launch announcement](https://www.nasa.gov/news-release/nasa-isro-satellite-lifts-off-to-track-earths-changing-surfaces/) (General Awareness #16).
- [British Stainless Steel Association technical explanation](https://bssa.org.uk/bssa_articles/when-is-stainless-steel-passive-or-active-formation-of-the-passive-layer/) (General Awareness #6).
- [Government of India's Sattriya origin summary](https://www.prod.incredibleindia.gov.in/content/incredible-india-v2/en/experiences/art/dance-forms.html) (General Awareness #12).
- [Indian Constitution Seventh Schedule, Government of India](https://www.legislative.gov.in/static/uploads/2025/08/7af1daa22d65f9d04c00ae9b9aa5a799.pdf) (General Awareness #4).

## Question-by-question answer-key trail

Each row records the **current keyed option text** and a concise reason verified during the desk audit. This is an AI review log, **not** a completed human editorial signoff.

### Reasoning

| # | Current keyed answer | Desk-check evidence |
|---:|---|---|
| 1 | A: 159 | ×2+1 yields 159 |
| 2 | B: U | Alphabet gaps increase; U |
| 3 | C: OCPIQ | Each MANGO letter shifted +2 |
| 4 | D: Compass : Direction | Compass direction parallels thermometer temperature |
| 5 | A: 500 | 500 is not a cube |
| 6 | B: Maternal uncle | Mother's brother is maternal uncle |
| 7 | C: Some pens are files | Some pens must also be files |
| 8 | D: 3 km east | Net displacement east 3km |
| 9 | A: L | K-L-M-N; L second |
| 10 | B: Thursday | 45 % 7 = 3: Thursday |
| 11 | C: 30 | 12+19−1=30 |
| 12 | D: Bird | Fertilised egg may become bird |
| 13 | A: 48 | Differences rise odd numbers to 48 |
| 14 | B: 4-15-7 | DOG positions 4-15-7 |
| 15 | C: Deepa | Deepa lowest in height chain |
| 16 | D: All roses are flowers | All roses are flowers stated |
| 17 | A: 5 | Four unit squares + one larger |
| 18 | B: 48 | TREE positions 20+18+5+5=48 |
| 19 | C: 17 | 6 before + S +10 after =17 |
| 20 | D: 5 | Opposite 2 is 5 in sum-seven die |
| 21 | A: EV | AZ BY CX DW EV |
| 22 | B: 14 | Explicit operator substitution =14 |
| 23 | C: Vani | Vani between Uma and Waseem |
| 24 | D: 2 | Punched double sheet yields two holes |
| 25 | A: Some catalogued books are reference books | Existing reference book is catalogued |

### General Awareness

| # | Current keyed answer | Desk-check evidence |
|---:|---|---|
| 1 | B: 26 November 1949 | Constitution adopted Nov 26 1949 |
| 2 | C: Article 21 | Article 21 for life/liberty |
| 3 | D: Part IV | DPSPs in Part IV |
| 4 | A: Seventh Schedule | Seventh Schedule contains 3 lists |
| 5 | B: Speaker of the Lok Sabha | Lok Sabha Speaker presides |
| 6 | C: Chromium produces a protective oxide film | Chromium oxide passivates stainless steel |
| 7 | D: Rigveda | Rigveda earliest Vedic collection |
| 8 | A: Meerut | 1857 sepoy rising started at Meerut |
| 9 | B: Salt tax | Dandi March challenged salt tax |
| 10 | C: Non-Cooperation Movement | Chauri Chaura preceded Non-Cooperation suspension |
| 11 | D: Kautilya | Arthashastra attributed to Kautilya |
| 12 | A: Assam | Sattriya originated in Assam |
| 13 | B: Western Ghats | Western Ghats parallel west coast |
| 14 | C: Bay of Bengal | Godavari empties into Bay of Bengal |
| 15 | D: Cotton | Black soil associated with cotton |
| 16 | A: NASA and ISRO | NISAR joint NASA–ISRO mission |
| 17 | B: Assam | Kaziranga in Assam |
| 18 | C: Stratosphere | Ozone mainly stratospheric |
| 19 | D: Iron | Haem contains iron |
| 20 | A: Scurvy | Vitamin C deficiency causes scurvy |
| 21 | B: Xylem | Xylem conducts water/minerals |
| 22 | C: 7 | Neutral pure water pH7 at 25°C |
| 23 | D: Barometer | Barometer for pressure |
| 24 | A: Changes in retail prices of a representative basket of consumer goods and services | CPI measures consumer basket inflation |
| 25 | B: Income tax | Income tax is a direct tax |

### Quantitative Aptitude

| # | Current keyed answer | Desk-check evidence |
|---:|---|---|
| 1 | C: 81 | 0.18×450=81 |
| 2 | D: ₹1,020 | 1200×0.85=1020 |
| 3 | A: 15% | 120/800=15% |
| 4 | B: ₹1,200 | 6000×8×2.5/100=1200 |
| 5 | C: ₹1,050 | 5000×(1.1²−1)=1050 |
| 6 | D: 60 | 96×5/8=60 |
| 7 | A: 20 | 100/5=20 |
| 8 | B: 7.2 days | 1/(1/12+1/18)=7.2 |
| 9 | C: 12 seconds | 300 metres/25 metres-per-second=12s |
| 10 | D: 10 km/h | Boat still-water=(12+8)/2=10 |
| 11 | A: 216 m² | 18×12=216 |
| 12 | B: 154 cm² | 22/7×49=154 |
| 13 | C: 75° | 180−40−65=75 |
| 14 | D: 15 | 360/24=15 |
| 15 | A: 42 | gcd(84,126)=42 |
| 16 | B: 60 | lcm(12,15,20)=60 |
| 17 | C: 23 | 25−2=23 |
| 18 | D: 3 and 4 | 3 and 4 roots |
| 19 | A: 15 cm | sqrt(81+144)=15 |
| 20 | B: 1/3 | 2 of 6 faces=1/3 |
| 21 | C: 1,540 cm³ | 22/7×7²×10=1540 |
| 22 | D: 20% | 6/30=20% with additive volumes |
| 23 | A: 3/5 | 3-4-5 triangle sin=3/5 |
| 24 | B: (0, 4) | x=0, y=4 |
| 25 | C: 25% | 50/200=25% |

### English Comprehension

| # | Current keyed answer | Desk-check evidence |
|---:|---|---|
| 1 | D: is | Neither singular→is |
| 2 | A: had been waiting | Past perfect continuous had been waiting |
| 3 | B: to | Objected to changes |
| 4 | C: an | Silent h of honest needs an |
| 5 | D: Thorough | Meticulous means thorough |
| 6 | A: Abundant | Scarce opposite abundant |
| 7 | B: Reveal a secret | Spill beans means reveal secret |
| 8 | C: Ornithologist | Ornithologist studies birds |
| 9 | D: Accommodation | Accommodation spelling two c and m |
| 10 | A: The proposal was approved by the manager. | Passive: was approved |
| 11 | B: She said that she was tired. | Reported speech: she was tired |
| 12 | C: He does not know the answer. | Does not know |
| 13 | D: hiking | Gerund hiking in parallel list |
| 14 | A: affect | Affect means influence; effect means bring about |
| 15 | B: Ease | Alleviate means ease |
| 16 | C: Although | Although concessive conjunction |
| 17 | D: at | Good at solving |
| 18 | A: Criteria | Criteria plural of criterion |
| 19 | B: clearly | Clearly is adverb |
| 20 | C: would have called | Would have called third conditional |
| 21 | D: Inconvenient opening hours | Office workers need after-six access |
| 22 | A: Stored energy in batteries | Batteries store energy |
| 23 | B: Checked the instructions | Mira checked instructions immediately beforehand |
| 24 | C: Crop rotation can help nitrogen management | Legumes may assist nitrogen management |
| 25 | D: Q-S-P-R | Growth order Q-S-P-R |

## Release decision

**HOLD — do not merge, import to Neon or publish.** A teacher/reviewer must sign off every item's key, wording, explanation, difficulty and Hindi/localisation requirements. Review the full SSC content mapping, implement/approve the applicable accommodation timing, and rehearse complete exam saving, section transitions and score calculation in staging first. Keep the draft topics and mock inactive. PR #45 stays Draft until the owner authorises review completion and merging.
