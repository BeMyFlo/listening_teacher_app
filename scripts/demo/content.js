// Nội dung bộ dữ liệu demo (chỉ là dữ liệu, không chạm DB). Dùng bởi
// scripts/seed-demo-workspace.js. Toàn bộ văn bản hiển thị là tiếng Anh.

// ---- helper dựng câu hỏi -------------------------------------------------
const fill = (id, pre, answers, post = "", extra = {}) => ({
  id, type: "fill", pre, post, answers: Array.isArray(answers) ? answers : [answers], ...extra,
});

// options: mảng nhãn; correct: chỉ số đáp án đúng
const choice = (id, pre, labels, correct, extra = {}) => {
  const keys = "abcdefgh";
  return {
    id, type: "choice", pre,
    options: labels.map((label, i) => ({ value: keys[i], label })),
    answers: [keys[correct]],
    ...extra,
  };
};

const TFNG_OPTIONS = [
  { value: "t", label: "TRUE" },
  { value: "f", label: "FALSE" },
  { value: "ng", label: "NOT GIVEN" },
];
const tfng = (id, statement, answer, extra = {}) => ({
  id, type: "choice", pre: statement, options: TFNG_OPTIONS, answers: [answer], ...extra,
});

const section = (name, fields, extra = {}) => ({ name, fields, ...extra });
const exercise = (title, sections) => ({ title, sections });
const word = (w, pos, ipa, meaning, def, example, collocation, synonyms) => ({
  word: w, partOfSpeech: pos, ipa, meaning, definitionEn: def, example, collocation, synonyms,
});

// ---- lớp + học sinh -------------------------------------------------------
const CLASSES = [
  { key: "A", name: "IELTS Foundation — Mon/Wed", level: 1 },
  { key: "B", name: "IELTS Intermediate — Tue/Thu", level: 2 },
];

// skill: xác suất trả lời đúng (0–1), dùng để sinh điểm bài tập cho thật
const STUDENTS = [
  { key: "a0", cls: "A", name: "An Nguyen", user: "an", skill: 0.9 },
  { key: "a1", cls: "A", name: "Binh Tran", user: "binh", skill: 0.75 },
  { key: "a2", cls: "A", name: "Chi Le", user: "chi", skill: 0.65 },
  { key: "a3", cls: "A", name: "Dung Pham", user: "dung", skill: 0.55 },
  { key: "a4", cls: "A", name: "Hoa Vu", user: "hoa", skill: 0.4 },
  { key: "a5", cls: "A", name: "Khanh Do", user: "khanh", skill: 0.8 },
  { key: "b0", cls: "B", name: "Lan Bui", user: "lan", skill: 0.9 },
  { key: "b1", cls: "B", name: "Minh Ngo", user: "minh", skill: 0.7 },
  { key: "b2", cls: "B", name: "Nam Dang", user: "nam", skill: 0.6 },
  { key: "b3", cls: "B", name: "Oanh Ha", user: "oanh", skill: 0.85 },
  { key: "b4", cls: "B", name: "Phuc Truong", user: "phuc", skill: 0.5 },
];

// ---- các Unit -------------------------------------------------------------
function unitA1() {
  const grammar = {
    key: "grammar",
    theory: { html: "# Grammar for daily life\nThis unit reviews the tenses we use to talk about routines and what is happening now." },
    topics: [
      {
        extId: "demo-g1",
        name: "Present Simple vs Present Continuous",
        lesson: {
          formula: "Present Simple: S + V(s/es)\nPresent Continuous: S + am / is / are + V-ing",
          whenToUse:
            "- **Present Simple** — habits, routines and facts: *She works at a bank.*\n" +
            "- **Present Continuous** — actions happening now or around now: *She is working today.*",
          commonMistakes:
            "- ❌ He go to school every day. → ✅ He **goes** to school every day.\n" +
            "- ❌ I am knowing the answer. → ✅ I **know** the answer. (State verbs such as *know*, *like*, *want* are not used in the continuous.)",
          examples: "Every morning I **drink** coffee.\nRight now I **am drinking** tea.",
        },
        exercises: [
          exercise("Choose the correct form", [
            section("Exercise 1", [
              choice(1, "She ___ to school by bike every day.", ["goes", "is going", "go"], 0,
                { explanation: "A daily routine, so we use the Present Simple. With *she* we add -es." }),
              choice(2, "Look! The children ___ in the garden.", ["play", "are playing", "plays"], 1,
                { explanation: "\"Look!\" tells us the action is happening now." }),
              choice(3, "I usually ___ breakfast at 7 a.m.", ["have", "am having", "has"], 0),
              choice(4, "Be quiet! The baby ___.", ["sleeps", "sleep", "is sleeping"], 2),
              choice(5, "Water ___ at 100 degrees Celsius.", ["boils", "is boiling", "boil"], 0,
                { explanation: "A general fact — Present Simple." }),
              fill(6, "My brother ___ (not / like) coffee.", ["doesn't like", "does not like"], "",
                { hint: "Use the negative Present Simple." }),
            ]),
          ]),
        ],
      },
      {
        extId: "demo-g2",
        name: "Adverbs of Frequency",
        lesson: {
          formula: "S + adverb + main verb\nS + be + adverb",
          whenToUse: "Use adverbs of frequency (*always, usually, often, sometimes, rarely, never*) to say **how often** something happens.",
          commonMistakes: "- ❌ I go **usually** to the gym. → ✅ I **usually** go to the gym.\n- ❌ She is late **never**. → ✅ She is **never** late.",
          examples: "I **always** brush my teeth before bed.\nHe is **rarely** late for class.",
        },
        exercises: [
          exercise("How often?", [
            section("Exercise 1", [
              choice(1, "She is ___ late for class. She arrives on time every day.", ["always", "never", "often"], 1),
              choice(2, "I ___ have cereal for breakfast — about five days a week.", ["usually", "rarely", "never"], 0),
              choice(3, "We ___ go to the cinema; maybe once a year.", ["always", "often", "rarely"], 2),
              choice(4, "He ___ forgets his keys. It happens almost every day!", ["often", "never", "hardly ever"], 0),
            ]),
          ]),
        ],
      },
    ],
  };

  const vocabulary = {
    key: "vocabulary",
    theory: { html: "# Vocabulary: daily routines\nLearn the words below, then practise them in the exercise." },
    groups: [
      {
        extId: "demo-v1",
        name: "Daily routines",
        words: [
          word("routine", "noun", "/ruːˈtiːn/", "thói quen hằng ngày", "the things you do regularly every day", "My morning routine starts at six.", "daily routine", "habit"),
          word("commute", "verb / noun", "/kəˈmjuːt/", "đi làm / đi học hằng ngày", "to travel regularly between home and work or school", "I commute to work by train.", "a long commute", "travel"),
          word("schedule", "noun", "/ˈʃedjuːl/", "lịch trình", "a plan of things to do and the times to do them", "I have a busy schedule this week.", "a tight schedule", "timetable"),
          word("exhausted", "adjective", "/ɪɡˈzɔːstɪd/", "kiệt sức", "extremely tired", "I was exhausted after the long flight.", "feel exhausted", "worn out"),
          word("relax", "verb", "/rɪˈlæks/", "thư giãn", "to rest and feel calm", "I relax by listening to music.", "relax at home", "unwind"),
          word("chore", "noun", "/tʃɔː/", "việc nhà", "a small job you must do regularly, especially at home", "Washing the dishes is my least favourite chore.", "household chores", "task"),
          word("attend", "verb", "/əˈtend/", "tham dự", "to be present at an event or a class", "She attends English classes twice a week.", "attend a meeting", "go to"),
          word("punctual", "adjective", "/ˈpʌŋktʃuəl/", "đúng giờ", "arriving at the correct time", "Please be punctual — the class starts at nine.", "always punctual", "on time"),
        ],
        exercises: [
          exercise("Fill in the blank", [
            section("Exercise 1", [
              fill(1, "My daily ___ starts with a cup of coffee.", "routine", "", { hint: "r_____" }),
              fill(2, "The ___ to my office takes 40 minutes by bus.", "commute"),
              fill(3, "I was ___ after working twelve hours without a break.", "exhausted"),
              fill(4, "Please be ___ — the meeting starts at 9 sharp.", "punctual"),
              fill(5, "I have a very busy ___ this week.", "schedule"),
            ]),
          ]),
        ],
      },
    ],
  };

  const listening = {
    key: "listening",
    theory: { html: "# Listening practice\n> **Demo note:** in a real lesson your recording plays here. This demo has no audio attached, so a transcript is provided instead — teachers upload audio in the **Audio Library**." },
    exercises: [
      exercise("Section 1 — Booking a table", [
        section("Restaurant booking", [
          fill(1, "Number of people:", ["4", "four"]),
          fill(2, "Time: ___ p.m.", ["7:30", "7.30", "7 30"]),
          fill(3, "Name: Mr ", "Carter"),
          fill(4, "Phone number: 0412 ", ["889 231", "889231"]),
        ], {
          passageText:
            "Transcript (demo): \"Good afternoon, Bella Vista Restaurant. — Hello, I'd like to book a table for four people on Friday the fourteenth. — Certainly. What time would you like? — Half past seven in the evening, please. — And your name? — It's Carter, C-A-R-T-E-R. — Thank you, Mr Carter. Could I have a contact number? — Yes, it's 0412 889 231. — Perfect, we'll see you on Friday.\"",
          noteText:
            "# Restaurant booking\nThe caller wants to book a table for [[1]] people.\n---\n- Date: Friday 14th\n- Time: [[2]] p.m.\n- Name: Mr [[3]]\n- Phone: 0412 [[4]]",
        }),
      ]),
    ],
  };

  const reading = {
    key: "reading",
    theory: { html: "# Reading tips\n- Skim the passage first for the main idea.\n- For **TRUE / FALSE / NOT GIVEN**, find the sentence that matches, then decide.\n- ==NOT GIVEN== means the passage does not say either way." },
    exercises: [
      exercise("Passage 1 — Cycling to work", [
        section("Questions 1–7", [
          tfng(1, "More than half of Copenhagen's residents cycle to work or school every day.", "t",
            { explanation: "The first paragraph says \"more than half of all residents\" ride a bicycle daily." }),
          tfng(2, "Bicycles are more expensive to own than cars.", "f",
            { explanation: "The passage says a bicycle \"costs far less than a car\"." }),
          tfng(3, "Regular exercise from cycling can improve heart health.", "t"),
          tfng(4, "Most cyclists in Copenhagen wear helmets.", "ng",
            { explanation: "Helmets are never mentioned, so the answer is NOT GIVEN." }),
          fill(5, "Cyclists in Copenhagen have traffic ___ designed for bikes.", "lights", "", { hint: "ONE WORD ONLY" }),
          fill(6, "Cycling in cities without bike lanes can be ___.", "dangerous", "", { hint: "ONE WORD ONLY" }),
          fill(7, "Some companies provide secure bike ___ for their staff.", "storage", "", { hint: "ONE WORD ONLY" }),
        ], {
          passageText:
            "Cycling has become one of the fastest-growing ways to travel in many cities. In Copenhagen, more than half of all residents ride a bicycle to work or school every day. Cyclists there enjoy dedicated lanes, traffic lights designed for bikes, and safe parking outside almost every building.\n\n" +
            "The benefits are clear. Cycling is cheap: a bicycle costs far less than a car, and there is no fuel to buy. It is also good for health, because regular exercise reduces the risk of heart disease. In addition, fewer cars on the road means less pollution and less noise.\n\n" +
            "However, cycling is not perfect for everyone. In cities with heavy traffic and no bike lanes, riding can be dangerous. Bad weather also discourages many people, and those who live far from their workplace may find the journey too long. Some companies now offer showers and secure bike storage to encourage staff to cycle, and several governments give small payments to people who choose two wheels instead of four.",
        }),
      ]),
    ],
  };

  const writing = {
    key: "writing",
    theory: { html: "# Writing\n- **Task 1:** describe the information objectively — no opinions.\n- **Task 2:** answer *every part* of the question and support ideas with examples.\n- Leave 2–3 minutes to check spelling and grammar." },
    prompts: [
      {
        title: "Task 2 — Working from home",
        writingTask: "task2",
        instructions:
          "Some people believe that working from home is better than working in an office.\n\nDiscuss both views and give your own opinion.\n\nWrite at least 250 words.",
      },
      {
        title: "Task 1 — Free-time activities",
        writingTask: "task1",
        instructions:
          "The table below shows the percentage of teenagers in one country who took part in four free-time activities in 2010 and 2020.\n\nSummarise the information by selecting and reporting the main features.\n\nWrite at least 150 words.\n\nActivity | 2010 | 2020\nWatching TV | 82% | 61%\nUsing social media | 35% | 88%\nPlaying sport | 54% | 49%\nReading for fun | 41% | 27%",
      },
    ],
  };

  const speaking = {
    key: "speaking",
    theory: { html: "# Speaking\nSpeak for as long as you can and **extend** your answers: give a reason and an example." },
    prompts: [
      {
        title: "Part 1 — Your daily routine",
        instructions: "Answer these questions:\n- What time do you usually get up?\n- What is your favourite part of the day? Why?\n- Do you prefer mornings or evenings?\n- Has your daily routine changed in the last few years?",
      },
      {
        title: "Part 2 — A place where you relax",
        instructions: "Describe a place where you like to relax.\nYou should say:\n- where it is\n- how often you go there\n- what you do there\nand explain why it helps you relax.",
      },
    ],
  };

  return { name: "Unit 1 — Daily Life", level: 1, order: 1, status: "published", categories: [grammar, vocabulary, listening, reading, writing, speaking] };
}

function unitA2() {
  return {
    name: "Unit 2 — Food & Health", level: 1, order: 2, status: "published",
    categories: [
      {
        key: "grammar",
        theory: { html: "# Grammar" },
        topics: [{
          extId: "demo-g3",
          name: "Countable and Uncountable Nouns",
          lesson: {
            formula: "many / a few + countable (plural)\nmuch / a little + uncountable\nsome / any / a lot of + both",
            whenToUse: "Use **many** with things you can count (*apples*) and **much** with things you cannot (*water*). In questions and negatives we use **any**.",
            commonMistakes: "- ❌ How many water do you drink? → ✅ How **much** water do you drink?\n- ❌ I need an advice. → ✅ I need **some advice**.",
            examples: "There aren't **any** apples left.\nHow **much** sugar do you take?",
          },
          exercises: [exercise("Quantifiers", [section("Exercise 1", [
            choice(1, "How ___ water do you drink a day?", ["much", "many", "a few"], 0),
            choice(2, "There aren't ___ apples left.", ["any", "some", "much"], 0),
            choice(3, "I'd like ___ advice, please.", ["a", "some", "many"], 1, { explanation: "*Advice* is uncountable, so we cannot say *an advice*." }),
            choice(4, "We have too ___ homework today.", ["many", "much", "few"], 1),
          ])])],
        }],
      },
      {
        key: "vocabulary",
        theory: { html: "# Vocabulary: food & health" },
        groups: [{
          extId: "demo-v2",
          name: "Food & health",
          words: [
            word("nutrition", "noun", "/njuˈtrɪʃn/", "dinh dưỡng", "the food you eat and its effect on your health", "Good nutrition is important for children.", "healthy nutrition", "nourishment"),
            word("diet", "noun", "/ˈdaɪət/", "chế độ ăn", "the food you usually eat", "She follows a vegetarian diet.", "a balanced diet", "eating habits"),
            word("balanced", "adjective", "/ˈbælənst/", "cân bằng", "having the right mix of different things", "A balanced meal includes vegetables and protein.", "balanced diet", "even"),
            word("ingredient", "noun", "/ɪnˈɡriːdiənt/", "nguyên liệu", "one of the foods used to make a dish", "Flour is the main ingredient in bread.", "key ingredient", "component"),
            word("allergy", "noun", "/ˈælədʒi/", "dị ứng", "a medical condition that makes you ill when you eat or touch something", "He has an allergy to peanuts.", "food allergy", "sensitivity"),
            word("portion", "noun", "/ˈpɔːʃn/", "khẩu phần", "an amount of food for one person", "The portions in this restaurant are huge.", "a large portion", "serving"),
          ],
          exercises: [exercise("Complete the sentences", [section("Exercise 1", [
            fill(1, "You should eat a ___ diet with plenty of vegetables.", "balanced"),
            fill(2, "He can't eat nuts because he has an ___.", "allergy"),
            fill(3, "Eggs are the main ___ in this recipe.", "ingredient"),
            fill(4, "The ___ was so big that I couldn't finish it.", "portion"),
          ])])],
        }],
      },
      {
        key: "reading",
        theory: { html: "# Reading" },
        exercises: [exercise("Passage 1 — Sleep and health", [section("Questions 1–5", [
          tfng(1, "Adults need at least seven hours of sleep a night.", "t"),
          tfng(2, "Drinking coffee in the evening helps people sleep better.", "f"),
          tfng(3, "Teenagers sleep less than adults in every country.", "ng"),
          fill(4, "Lack of sleep can make it hard to ___ new information.", "remember", "", { hint: "ONE WORD ONLY" }),
          fill(5, "Experts advise switching off ___ an hour before bed.", "screens", "", { hint: "ONE WORD ONLY" }),
        ], {
          passageText:
            "Most adults need at least seven hours of sleep a night to stay healthy. When we do not sleep enough, our bodies and minds suffer. Tired people find it harder to concentrate, and lack of sleep can make it hard to remember new information.\n\nMany habits affect how well we sleep. Drinking coffee in the evening keeps people awake, while a regular bedtime helps the body relax. Experts also advise switching off screens an hour before bed, because the light from phones and laptops can delay sleep.",
        })])],
      },
      {
        key: "writing",
        theory: { html: "# Writing" },
        prompts: [{
          title: "Task 2 — Fast food",
          writingTask: "task2",
          instructions: "Fast food is becoming more popular in many countries.\n\nWhat are the reasons for this? Is it a positive or a negative development?\n\nWrite at least 250 words.",
        }],
      },
    ],
  };
}

function unitB1() {
  return {
    name: "Unit 1 — Technology & Society", level: 2, order: 1, status: "published",
    categories: [
      {
        key: "grammar",
        theory: { html: "# Grammar" },
        topics: [{
          extId: "demo-g4",
          name: "The Passive Voice",
          lesson: {
            formula: "S + be (am / is / are / was / were / will be) + past participle",
            whenToUse: "Use the passive when the **action** is more important than **who did it**, or when we do not know who did it.",
            commonMistakes: "- ❌ The bridge built in 1998. → ✅ The bridge **was built** in 1998.\n- ❌ English is speaking in many countries. → ✅ English **is spoken** in many countries.",
            examples: "The report **will be finished** by Friday.\nThousands of photos **are shared** online every second.",
          },
          exercises: [exercise("Active to passive", [section("Exercise 1", [
            fill(1, "The bridge ___ (build) in 1998.", "was built"),
            fill(2, "English ___ (speak) in many countries.", "is spoken"),
            fill(3, "The report ___ (finish) by Friday.", "will be finished"),
            choice(4, "The email ___ yesterday afternoon.", ["was sent", "is sent", "sent"], 0),
          ])])],
        }],
      },
      {
        key: "vocabulary",
        theory: { html: "# Vocabulary: technology" },
        groups: [{
          extId: "demo-v3",
          name: "Technology",
          words: [
            word("innovation", "noun", "/ˌɪnəˈveɪʃn/", "sự đổi mới", "a new idea, method or device", "Smartphones were a major innovation.", "technological innovation", "breakthrough"),
            word("device", "noun", "/dɪˈvaɪs/", "thiết bị", "a machine or tool made for a particular purpose", "Turn off all electronic devices.", "mobile device", "gadget"),
            word("privacy", "noun", "/ˈprɪvəsi/", "quyền riêng tư", "the right to keep your personal information secret", "Social media raises privacy concerns.", "protect privacy", "confidentiality"),
            word("addicted", "adjective", "/əˈdɪktɪd/", "nghiện", "unable to stop doing something", "Many teenagers are addicted to their phones.", "addicted to", "hooked"),
            word("upgrade", "verb / noun", "/ʌpˈɡreɪd/", "nâng cấp", "to improve something by replacing it with a newer version", "I need to upgrade my laptop.", "software upgrade", "update"),
            word("artificial", "adjective", "/ˌɑːtɪˈfɪʃl/", "nhân tạo", "made by people, not natural", "Artificial intelligence is changing many jobs.", "artificial intelligence", "man-made"),
          ],
          exercises: [exercise("Complete the sentences", [section("Exercise 1", [
            fill(1, "Online ___ is a growing concern for many internet users.", "privacy"),
            fill(2, "The latest phone is a real ___ compared with older models.", "innovation"),
            fill(3, "Some teenagers are ___ to video games.", "addicted"),
            fill(4, "You should ___ your software to fix security problems.", "upgrade"),
          ])])],
        }],
      },
      {
        key: "reading",
        theory: { html: "# Reading" },
        exercises: [exercise("Passage 1 — Smartphones in class", [section("Questions 1–6", [
          choice(1, "According to the passage, what is the main concern of teachers?", ["Phones are too expensive", "Phones distract students", "Phones are too heavy"], 1),
          choice(2, "Which school has banned phones completely?", ["Riverside School", "Oakwood School", "Hilltop School"], 0),
          tfng(3, "Students at Oakwood School must keep phones in a locker.", "f"),
          tfng(4, "Some teachers use phones for classroom quizzes.", "t"),
          fill(5, "Teachers say students find it hard to ___ when notifications appear.", "concentrate", "", { hint: "ONE WORD ONLY" }),
          fill(6, "Riverside School reported better exam ___ after the ban.", "results", "", { hint: "ONE WORD ONLY" }),
        ], {
          passageText:
            "Smartphones have changed classrooms around the world. Many teachers say that phones distract students, who find it hard to concentrate when notifications appear on their screens.\n\nSome schools have reacted strongly. Riverside School banned phones completely two years ago and reported better exam results afterwards. Oakwood School chose a different approach: students may bring phones but must leave them in a bag during lessons.\n\nNot everyone agrees that phones are the problem. Some teachers use them for classroom quizzes and research, arguing that students should learn to use technology responsibly.",
        })])],
      },
      {
        key: "writing",
        theory: { html: "# Writing" },
        prompts: [{
          title: "Task 2 — Technology and children",
          writingTask: "task2",
          instructions: "Some people think that children should not be allowed to use smartphones until they are older.\n\nTo what extent do you agree or disagree?\n\nWrite at least 250 words.",
        }],
      },
      {
        key: "speaking",
        theory: { html: "# Speaking" },
        prompts: [{
          title: "Part 1 — Technology you use",
          instructions: "Answer these questions:\n- What technology do you use every day?\n- Do you think you spend too much time online?\n- How has technology changed the way people study?",
        }],
      },
    ],
  };
}

function unitB2Draft() {
  return { name: "Unit 2 — The Environment (draft)", level: 2, order: 2, status: "draft", categories: null };
}

// ---- bài thi thử ----------------------------------------------------------
function mockTest() {
  return {
    title: "IELTS Mock Test 1",
    unit: "Demo",
    level: 1,
    status: "published",
    skills: {
      listening: {
        durationMinutes: 30,
        instructions: "Read the transcript and answer the questions. (Demo — no audio attached.)",
        sections: [section("Section 1", [
          fill(1, "Caller's name:", "Carter"),
          fill(2, "Table for ___ people.", ["4", "four"]),
          fill(3, "Booking day:", "Friday"),
          fill(4, "Time: ___ p.m.", ["7:30", "7.30"]),
          fill(5, "Contact number: 0412 ", ["889 231", "889231"]),
        ], {
          passageText: "Transcript (demo): \"…I'd like to book a table for four people on Friday. — What time? — Half past seven in the evening. — Your name? — Carter. — And a number? — 0412 889 231.\"",
        })],
      },
      reading: {
        durationMinutes: 60,
        instructions: "Read the passage and answer the questions.",
        sections: [section("Passage 1 — The rise of vertical farming", [
          tfng(1, "Vertical farms can operate in the middle of a city.", "t"),
          tfng(2, "Vertical farms use more water than traditional farms.", "f"),
          tfng(3, "Vertical farming has already replaced traditional farming in Europe.", "ng"),
          fill(4, "Plants in vertical farms grow under artificial ___.", "light", "", { hint: "ONE WORD ONLY" }),
          fill(5, "Vertical farms are built in stacked ___.", "layers", "", { hint: "ONE WORD ONLY" }),
          fill(6, "The main disadvantage is the high cost of ___.", "electricity", "", { hint: "ONE WORD ONLY" }),
        ], {
          passageText:
            "Vertical farming is a method of growing food in stacked layers, often inside buildings. Because these farms do not need fields, they can operate in the middle of a city, close to the people who eat the food.\n\nPlants in vertical farms grow under artificial light and receive exactly the water and nutrients they need. As a result, such farms use up to ninety per cent less water than traditional farming.\n\nDespite these advantages, the technology is still expensive. The main disadvantage is the high cost of electricity for the lights, which makes many vertical farm products more expensive than ordinary vegetables.",
        })],
      },
      writing: {
        durationMinutes: 60,
        instructions: "Write your answer in full sentences.",
        prompts: [{
          title: "Task 2 — Public transport",
          writingTask: "task2",
          instructions: "Some people think governments should spend more money on public transport rather than on building new roads.\n\nTo what extent do you agree or disagree?\n\nWrite at least 250 words.",
        }],
      },
      speaking: {
        durationMinutes: 14,
        instructions: "Record your answers clearly.",
        prompts: [{
          title: "Part 1 — Hometown",
          instructions: "Answer these questions:\n- Where is your hometown?\n- What do you like most about it?\n- Has it changed much in recent years?",
        }],
      },
    },
  };
}

// ---- bài luận mẫu (có lỗi cố ý) + chú thích -------------------------------
const ESSAYS = {
  // học sinh a0 — Unit A1 — Task 2 "Working from home" — đã chấm 6.5
  a0_wfh: {
    text:
      "Nowadays, many people work from home instead of going to the office. In my opinion, both ways have advantages and disadvantages, but I think working at home is better for most of workers.\n\n" +
      "On the one hand, working from home save a lot of time and money. Employees do not need to travel every day, so they can sleep more and avoid the traffic jam. In addition, they spend less money on transportation and lunch. For example, my uncle works as a programmer and he told me that he saved nearly two hours every day after his company allowed remote work.\n\n" +
      "On the other hand, some people believe that the office is more better because colleagues can discuss directly. Working alone at home may make people feel lonely, and it is difficult to separate work and family life. Moreover, some jobs such as teachers or doctors can not be done from home.\n\n" +
      "In conclusion, I agree that working from home is a good choice for many people because it is convenient and flexible. However, companies should also organise meetings sometimes so that employees do not lose contact with their team.",
    criteria: [{ key: "TR", band: 7, comment: "You answer both views and give a clear opinion, with a relevant example." }, { key: "CC", band: 6, comment: "Clear paragraphs, but linking words are repeated (On the one hand / On the other hand)." }, { key: "LR", band: 6, comment: "Adequate vocabulary; try less common collocations." }, { key: "GRA", band: 6, comment: "Mostly clear, but there are still errors with subject-verb agreement and comparatives." }],
    feedback: "A well-organised essay with a clear position. To reach Band 7, work on grammatical accuracy (agreement, comparatives) and use a wider range of linking phrases.",
    annotations: [
      { quote: "working at home is better for most of workers", action: "replace", insertText: "working at home is better for most workers", category: "grammar", criterion: "GRA", severity: "minor", comment: "Remove \"of\": most + noun." },
      { quote: "working from home save a lot of time", action: "replace", insertText: "working from home saves a lot of time", category: "grammar", criterion: "GRA", severity: "noticeable", comment: "Subject-verb agreement: a gerund subject takes a singular verb." },
      { quote: "avoid the traffic jam", action: "replace", insertText: "avoid traffic jams", category: "grammar", criterion: "GRA", severity: "minor", comment: "Use the plural without \"the\" for a general idea." },
      { quote: "For example, my uncle works as a programmer", action: "comment", category: "idea", criterion: "TR", severity: null, comment: "Good, specific example — it supports your point well." },
      { quote: "more better", action: "replace", insertText: "better", category: "grammar", criterion: "GRA", severity: "noticeable", comment: "\"Better\" is already a comparative — never use \"more\" with it." },
      { quote: "can not", action: "replace", insertText: "cannot", category: "spelling", criterion: "LR", severity: "minor", comment: "Write \"cannot\" as one word." },
    ],
    priorities: ["Subject-verb agreement with -ing subjects (working … saves)", "Comparatives: better, not \"more better\"", "Vary linking phrases beyond On the one hand / On the other hand"],
    topicVocabulary: [
      { term: "flexible working hours", meaning: "giờ làm việc linh hoạt", example: "Flexible working hours help parents balance work and family." },
      { term: "remote work", meaning: "làm việc từ xa", example: "Remote work has become common since 2020." },
      { term: "work-life balance", meaning: "cân bằng công việc – cuộc sống", example: "Working from home can improve work-life balance." },
    ],
    improvedSample:
      "Nowadays, many people work from home instead of going to the office. In my opinion, both approaches have advantages and disadvantages, but I believe working from home is better for most workers.\n\nOn the one hand, working from home saves a great deal of time and money. Employees do not need to commute every day, so they can sleep more and avoid traffic jams…",
  },
  a1_wfh: {
    text:
      "Working from home is very popular now. Some people think it is good but other people think it is bad. I will discuss both view.\n\n" +
      "First, working at home is comfortable. You can wear what you want and you can eat at home. Also you do not lose time on the bus. This is a big advantage for people who live far from the city center.\n\n" +
      "But, working at home have some problems. When you stay at home the whole day, you can feel lonely because you do not talk with colleagues. Also many people is distracted by family or by television and they cannot work efficient.\n\n" +
      "In conclusion, I think working from home and working in the office are both good, it depends of the person.",
    criteria: [{ key: "TR", band: 5, comment: "Both views are mentioned but ideas need more development and examples." }, { key: "CC", band: 6, comment: "Simple but logical organisation." }, { key: "LR", band: 5, comment: "Limited range; some word-form errors." }, { key: "GRA", band: 6, comment: "Simple sentences are mostly accurate; complex sentences contain errors." }],
    feedback: "You covered both sides, which is good. Develop each idea with a reason and an example, and watch word forms (efficient → efficiently).",
    annotations: [
      { quote: "I will discuss both view.", action: "replace", insertText: "I will discuss both views.", category: "grammar", criterion: "GRA", severity: "minor", comment: "\"Both\" needs a plural noun." },
      { quote: "working at home have some problems", action: "replace", insertText: "working at home has some problems", category: "grammar", criterion: "GRA", severity: "noticeable", comment: "Agreement: working (singular) → has." },
      { quote: "many people is distracted", action: "replace", insertText: "many people are distracted", category: "grammar", criterion: "GRA", severity: "noticeable", comment: "\"People\" is plural → are." },
      { quote: "work efficient", action: "replace", insertText: "work efficiently", category: "grammar", criterion: "LR", severity: "minor", comment: "You need an adverb after the verb." },
      { quote: "it depends of the person", action: "replace", insertText: "it depends on the person", category: "grammar", criterion: "GRA", severity: "minor", comment: "depend + on." },
    ],
    priorities: ["Develop each idea with an example", "Word forms: adjective vs adverb", "Fixed prepositions: depend on"],
    topicVocabulary: [
      { term: "distraction", meaning: "sự xao nhãng", example: "Noise at home is a common distraction." },
      { term: "commute", meaning: "đi làm hằng ngày", example: "A long commute is tiring." },
    ],
    improvedSample: "Working from home has become very popular. Some people believe it is beneficial, while others think it has serious drawbacks. This essay will discuss both views…",
  },
  a2_wfh: {
    text:
      "In the modern world many people choose to work at home. There are many reasons for this. Firstly, the internet is fast and cheap so people can send documents and have online meetings easily. Secondly, companies save money because they do not need a big office.\n\nHowever, there are some disadvantages. Some workers feel isolated and their motivation can decrease. I think the best solution is to work at home two or three days per week and go to the office on other days.",
  },
  a3_free: {
    text:
      "The table show the percentage of teenagers who did four free time activities in 2010 and 2020.\n\nIn 2010 watching TV was the most popular activity with 82 percent, but it fell to 61 percent in 2020. On the other hand, the number of teenagers using social media rose sharply from 35 percent to 88 percent, and it became the most popular activity in 2020.\n\nPlaying sport decreased slightly from 54 percent to 49 percent. Reading for fun was the least popular activity and it fell from 41 percent to 27 percent.\n\nOverall, social media grew a lot while the other three activities became less popular.",
  },
  b0_tech: {
    text:
      "It is often argued that children should not have smartphones until they are older. While I agree that young children need some limits, I do not believe a complete ban is the best solution.\n\n" +
      "On the one hand, there are genuine risks. Young children who spend hours on a screen may have difficulty concentrating at school, and unrestricted internet access exposes them to inappropriate content. Sleep can also suffer if a phone is kept in the bedroom overnight.\n\n" +
      "On the other hand, smartphones offer real benefits. They allow parents to contact their children in an emergency, and they give access to educational apps and videos that can support learning. Moreover, children who never use technology may fall behind their classmates, since digital skills are increasingly important in modern jobs.\n\n" +
      "Therefore, rather than forbidding phones, parents should set clear rules, such as time limits and no devices during meals or at night. In this way, children can enjoy the advantages of technology while avoiding its dangers.\n\n" +
      "In conclusion, I only partly agree with the statement: age limits on unsupervised use make sense, but supervised and moderate use is beneficial.",
    criteria: [{ key: "TR", band: 7, comment: "Clear position throughout; both sides developed with relevant support." }, { key: "CC", band: 7, comment: "Logical paragraphing and a good range of cohesive devices." }, { key: "LR", band: 7, comment: "Good range with some less common items (unrestricted, inappropriate)." }, { key: "GRA", band: 7, comment: "A variety of complex structures with few errors." }],
    feedback: "A strong, well-balanced essay. To reach Band 8, aim for more precise, less predictable vocabulary and make your conclusion more decisive.",
    annotations: [
      { quote: "Young children who spend hours on a screen", action: "comment", category: "idea", criterion: "TR", severity: null, comment: "Nice, precise support for the first risk." },
      { quote: "difficulty concentrating", action: "comment", category: "vocabulary", criterion: "LR", severity: null, comment: "Good collocation." },
      { quote: "I only partly agree with the statement", action: "replace", insertText: "I partly agree with the statement", category: "style", criterion: "GRA", severity: "minor", comment: "\"Only\" is unnecessary here; \"partly\" already limits your agreement." },
    ],
    priorities: ["Make the conclusion more decisive", "Use more precise vocabulary (e.g. detrimental, beneficial in moderation)"],
    topicVocabulary: [
      { term: "screen time", meaning: "thời gian dùng màn hình", example: "Experts recommend limiting screen time for young children." },
      { term: "digital literacy", meaning: "năng lực số", example: "Digital literacy is essential in modern jobs." },
    ],
    improvedSample: "It is often argued that smartphones should be kept away from children until they are older. Although young children clearly need boundaries, I do not believe a blanket ban is the most effective solution…",
  },
  b1_tech: {
    text:
      "Nowadays almost every child has a smartphone and many parents worry about it. I agree that children should not use phones too much.\n\nFirst, phones can be bad for health. If children look at the screen for a long time, their eyes can be tired and they may sleep late. Second, some children play games all day and do not do homework, so their marks become lower.\n\nHowever, phones are also useful because children can call their parents and learn English with apps. So parents should control the time, not ban the phone completely.",
  },
};

module.exports = {
  CLASSES, STUDENTS, ESSAYS,
  unitA1, unitA2, unitB1, unitB2Draft, mockTest,
};
