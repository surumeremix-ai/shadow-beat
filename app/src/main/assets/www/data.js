// Shadow Beat — stage data.
// Each stage is a short British-English exchange, reduced to the *stressed*
// (content) words only — those are the words the player says on the beat.
// `b` marks the stressed-syllable slice to render bold, as [start, end)
// character indices into `w`.

const TRACKS = {
  daily: {
    name: "日常会話編",
    bpm: 100,
    stages: [
      {
        title: "カフェで注文",
        line: "What can I get you? / I'll have a flat white, please.",
        words: [
          { w: "you",   ipa: "/juː/",     b: [0, 3] },
          { w: "have",  ipa: "/hæv/",     b: [0, 4] },
          { w: "flat",  ipa: "/flæt/",    b: [0, 4] },
          { w: "white", ipa: "/waɪt/",    b: [0, 5] },
          { w: "please",ipa: "/pliːz/",   b: [0, 6] },
        ],
      },
      {
        title: "道を尋ねる",
        line: "Excuse me, is the station near here? / Yeah, just round the corner.",
        words: [
          { w: "Excuse",  ipa: "/ɪkˈskjuːz/", b: [2, 6] },
          { w: "station", ipa: "/ˈsteɪʃn/",   b: [0, 3] },
          { w: "near",    ipa: "/nɪə/",       b: [0, 4] },
          { w: "here",    ipa: "/hɪə/",       b: [0, 4] },
          { w: "Yeah",    ipa: "/jeə/",       b: [0, 4] },
          { w: "round",   ipa: "/raʊnd/",     b: [0, 5] },
          { w: "corner",  ipa: "/ˈkɔːnə/",    b: [0, 3] },
        ],
      },
      {
        title: "電話で待ち合わせ",
        line: "Where are you? / I'm running a bit late, sorry!",
        words: [
          { w: "Where",   ipa: "/weə/",     b: [0, 5] },
          { w: "you",     ipa: "/juː/",     b: [0, 3] },
          { w: "running", ipa: "/ˈrʌnɪŋ/",  b: [0, 3] },
          { w: "bit",     ipa: "/bɪt/",     b: [0, 3] },
          { w: "late",    ipa: "/leɪt/",    b: [0, 4] },
          { w: "sorry",   ipa: "/ˈsɒri/",   b: [0, 3] },
        ],
      },
      {
        title: "買い物",
        line: "Can I try this on? / Sure, the fitting room's over there.",
        words: [
          { w: "try",     ipa: "/traɪ/",    b: [0, 3] },
          { w: "on",      ipa: "/ɒn/",      b: [0, 2] },
          { w: "Sure",    ipa: "/ʃʊə/",     b: [0, 4] },
          { w: "fitting", ipa: "/ˈfɪtɪŋ/",  b: [0, 3] },
          { w: "room's",  ipa: "/ruːmz/",   b: [0, 6] },
          { w: "over",    ipa: "/ˈəʊvə/",   b: [0, 1] },
          { w: "there",   ipa: "/ðeə/",     b: [0, 5] },
        ],
      },
      {
        title: "天気の雑談",
        line: "Lovely day, isn't it? / Yeah, finally some sun!",
        words: [
          { w: "Lovely",  ipa: "/ˈlʌvli/",  b: [0, 4] },
          { w: "day",     ipa: "/deɪ/",     b: [0, 3] },
          { w: "isn't",   ipa: "/ˈɪznt/",   b: [0, 2] },
          { w: "Yeah",    ipa: "/jeə/",     b: [0, 4] },
          { w: "finally", ipa: "/ˈfaɪnəli/",b: [0, 2] },
          { w: "sun",     ipa: "/sʌn/",     b: [0, 3] },
        ],
      },
      {
        title: "別れの挨拶",
        line: "It was great seeing you. / You too, take care!",
        words: [
          { w: "great",  ipa: "/ɡreɪt/",  b: [0, 5] },
          { w: "seeing", ipa: "/ˈsiːɪŋ/", b: [0, 3] },
          { w: "you",    ipa: "/juː/",    b: [0, 3] },
          { w: "You",    ipa: "/juː/",    b: [0, 3] },
          { w: "too",    ipa: "/tuː/",    b: [0, 3] },
          { w: "care",   ipa: "/keə/",    b: [0, 4] },
        ],
      },
    ],
  },
  business: {
    name: "ビジネス編",
    bpm: 80,
    stages: [
      {
        title: "会議の開始",
        line: "Shall we get started? / Yes, let's dive right in.",
        words: [
          { w: "Shall",   ipa: "/ʃæl/",     b: [0, 5] },
          { w: "started", ipa: "/ˈstɑːtɪd/",b: [0, 5] },
          { w: "Yes",     ipa: "/jes/",     b: [0, 3] },
          { w: "dive",    ipa: "/daɪv/",    b: [0, 4] },
          { w: "right",   ipa: "/raɪt/",    b: [0, 5] },
          { w: "in",      ipa: "/ɪn/",      b: [0, 2] },
        ],
      },
      {
        title: "予定調整",
        line: "Does Tuesday work for you? / Actually, could we push it to Wednesday?",
        words: [
          { w: "Tuesday",  ipa: "/ˈtjuːzdeɪ/", b: [0, 4] },
          { w: "work",     ipa: "/wɜːk/",      b: [0, 4] },
          { w: "you",      ipa: "/juː/",       b: [0, 3] },
          { w: "Actually", ipa: "/ˈæktʃuəli/", b: [0, 2] },
          { w: "could",    ipa: "/kʊd/",       b: [0, 5] },
          { w: "push",     ipa: "/pʊʃ/",       b: [0, 4] },
          { w: "Wednesday",ipa: "/ˈwenzdeɪ/",  b: [0, 6] },
        ],
      },
      {
        title: "メール確認",
        line: "Did you get my email? / Yes, I'll reply by end of day.",
        words: [
          { w: "get",   ipa: "/ɡet/",     b: [0, 3] },
          { w: "email", ipa: "/ˈiːmeɪl/", b: [0, 2] },
          { w: "Yes",   ipa: "/jes/",     b: [0, 3] },
          { w: "reply", ipa: "/rɪˈplaɪ/", b: [2, 5] },
          { w: "end",   ipa: "/end/",     b: [0, 3] },
          { w: "day",   ipa: "/deɪ/",     b: [0, 3] },
        ],
      },
      {
        title: "意見を述べる",
        line: "I think we should reconsider. / Fair point, let's discuss it.",
        words: [
          { w: "think",       ipa: "/θɪŋk/",         b: [0, 5] },
          { w: "should",      ipa: "/ʃʊd/",          b: [0, 6] },
          { w: "reconsider",  ipa: "/ˌriːkənˈsɪdə/", b: [6, 8] },
          { w: "Fair",        ipa: "/feə/",          b: [0, 4] },
          { w: "point",       ipa: "/pɔɪnt/",        b: [0, 5] },
          { w: "let's",       ipa: "/lets/",         b: [0, 5] },
          { w: "discuss",     ipa: "/dɪˈskʌs/",      b: [3, 7] },
        ],
      },
      {
        title: "プレゼン後の質疑",
        line: "Any questions so far? / Just one — what's the timeline?",
        words: [
          { w: "Any",       ipa: "/ˈeni/",      b: [0, 1] },
          { w: "questions", ipa: "/ˈkwestʃənz/",b: [0, 4] },
          { w: "far",       ipa: "/fɑː/",       b: [0, 3] },
          { w: "Just",      ipa: "/dʒʌst/",     b: [0, 4] },
          { w: "one",       ipa: "/wʌn/",       b: [0, 3] },
          { w: "what's",    ipa: "/wɒts/",      b: [0, 6] },
          { w: "timeline",  ipa: "/ˈtaɪmlaɪn/", b: [0, 4] },
        ],
      },
      {
        title: "商談のクロージング",
        line: "Shall we move forward with this? / Sounds good, let's do it.",
        words: [
          { w: "Shall",   ipa: "/ʃæl/",   b: [0, 5] },
          { w: "move",    ipa: "/muːv/",  b: [0, 4] },
          { w: "forward", ipa: "/ˈfɔːwəd/",b: [0, 3] },
          { w: "this",    ipa: "/ðɪs/",   b: [0, 4] },
          { w: "Sounds",  ipa: "/saʊndz/",b: [0, 6] },
          { w: "good",    ipa: "/ɡʊd/",   b: [0, 4] },
          { w: "let's",   ipa: "/lets/",  b: [0, 5] },
          { w: "do",      ipa: "/duː/",   b: [0, 2] },
        ],
      },
    ],
  },
};
