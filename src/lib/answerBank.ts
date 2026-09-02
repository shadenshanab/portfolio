/**
 * Local, client-side answer bank for the AI Twin.
 *
 * Phase 1 backend: no network, no cost, no downtime. Scores an incoming question
 * against keyword sets (English + Arabic) and returns the best-matching grounded answer.
 * Phase 2 swaps this for streaming HuggingFace responses via `src/lib/api.ts`,
 * keeping this file as the automatic fallback.
 *
 * Output is English-only by design: visitors can ask in English or Arabic — the
 * Arabic keyword sets below exist purely to detect *which topic* an Arabic question
 * is about — but every answer, live LLM or local fallback, always replies in English.
 *
 * Voice: every answer is written in the first person, as Shaden speaking in an
 * interview ("I built...", "my experience..."), never as a third-person case study.
 * When nothing matches, the fallback hands the reader her email and phone rather
 * than guessing.
 */

export type Intent = {
  id: string
  keywords: string[]
  /** Extra weight for very specific terms. */
  strong?: string[]
  /** Generic openers ("about", "tell me about") — present but never decisive. */
  weak?: string[]
  en: string
  sources?: string[]
}

export const isArabic = (text: string) => /[؀-ۿ]/.test(text)

/**
 * Arabic words carry prefixes (ال، بال، وال، لل) and suffixes (ها، هم، ية),
 * so matching whole words fails. We normalise orthography and match on roots
 * as substrings instead — `بالذكاء` still contains `ذكاء`.
 */
function normalizeAr(text: string) {
  return text
    .replace(/[ً-ْـ]/g, '') // diacritics + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
}

/** Arabic roots per intent, matched as substrings after normalisation. */
const arRoots: Record<string, string[]> = {
  greeting: ['مرحب', 'اهلا', 'سلام', 'هلا', 'كيفك', 'صباح', 'مساء'],
  about: ['مين', 'من هي', 'عرفيني', 'شو بتعمل'],
  voice: ['صوت', 'مكالم', 'لهج', 'نطق', 'كلام', 'اتصال', 'سماع'],
  arabic: ['عربي', 'لغه', 'ثنائي', 'فصح', 'ترجم'],
  pii: ['خصوصي', 'حوكم', 'بيانات شخصي', 'امتثال', 'تنظيمي', 'قانوني', 'سري'],
  sql: ['استعلام', 'قاعده بيانات', 'قواعد بيانات', 'جدول', 'تحليل بيانات'],
  llm: ['وكيل', 'وكلاء', 'نماذج لغوي', 'شات', 'ذكاء', 'توليدي', 'محادث', 'روبوت'],
  forecasting: ['تنبو', 'توقع', 'سلاسل زمني', 'مبيعات', 'طلب'],
  engineering: ['هندسه بيانات', 'خطوط', 'مستودع', 'تكامل', 'نقل بيانات'],
  fullstack: ['واجه', 'ويب', 'تطوير', 'برمج', 'فل ستاك', 'موقع'],
  sentiment: ['مشاعر', 'تصعيد', 'رضا', 'انفعال', 'غضب', 'احباط'],
  experience: ['خبر', 'شغل', 'وين اشتغل', 'شركات', 'سنوات', 'مسير', 'وظائف'],
  education: ['تعليم', 'شهاد', 'جامع', 'دراس', 'معدل', 'جائز', 'تخرج', 'دبلوم'],
  skills: ['مهار', 'ادوات', 'تقنيات', 'بايثون', 'بتعرف', 'لغات برمج'],
  hire: ['توظيف', 'تواصل', 'ايميل', 'بريد', 'متاح', 'استشار', 'اشتغل معها', 'تعيين', 'راتب'],
  strengths: ['ليش', 'لماذا', 'مميز', 'قوه', 'افضل', 'نقاط القوه'],
}

/** Generic Arabic openers — they signal an intent but must never outrank a topic word. */
const arWeak: Record<string, string[]> = {
  about: ['حكيلي', 'احكيلي', 'عنها', 'نبذه', 'خلفيه'],
}

export const intents: Intent[] = [
  {
    id: 'greeting',
    keywords: ['hi', 'hello', 'hey', 'salam', 'marhaba', 'مرحبا', 'اهلا', 'أهلا', 'السلام', 'هلا', 'كيفك'],
    en: "Hey — I'm Shaden. Ask me whatever you'd ask in an interview: the voice agents I've built, my LLM and agentic systems, Arabic NLP, PII detection, the data platforms underneath, or the teams I've shipped things with. Ask in English or Arabic — I'll answer in English.",
  },
  {
    id: 'about',
    keywords: ['who', 'yourself', 'introduce', 'profile'],
    weak: ['about', 'background', 'summary', 'tell me about'],
    en: "I'm a senior full-stack data scientist based in Amman, Jordan. I build production AI systems end to end — retail, fintech, SaaS and data governance. I'm TensorFlow certified, and Jordan's Ministry of Higher Education recognised me as the country's top AI student in 2023. My range covers ML pipelines, forecasting, LLM engineering, agentic AI and conversational systems — plus the full-stack work to actually ship them.",
  },
  {
    id: 'voice',
    keywords: ['voice', 'speech', 'stt', 'tts', 'call', 'audio', 'talk', 'agent', 'dialect', 'barge', 'صوت', 'صوتي', 'مكالمة', 'لهجة', 'نطق', 'كلام'],
    strong: ['voice-to-voice', 'voice agent', 'speech to text', 'text to speech'],
    en: "Voice is one of my strongest areas. I built an agentic voice-to-voice customer service agent: real-time speech-to-text, dialect-aware text-to-speech, and an LLM orchestration layer with function calling that performs live actions mid-call — database lookups, API calls, even call transfer. It classifies the caller's Arabic dialect and replies in that dialect rather than defaulting to MSA, uses voice activity detection with barge-in for natural turn-taking, and runs sentiment detection inside the loop to catch frustration and escalate. I also contributed to a call analytics platform that detects emotional tone from voice and writes Arabic quality reports.",
    sources: ['voice-agent', 'call-analytics'],
  },
  {
    id: 'arabic',
    keywords: ['arabic', 'bilingual', 'dialects', 'msa', 'rtl'],
    strong: ['arabic'],
    en: "Arabic is my native language, and it shows up as real engineering rather than a checkbox. I've done Arabic dialect classification with dialect-matched generation for voice agents, built an entirely Arabic-language contact centre portal with RTL UX, shipped Arabic call-quality reporting, and designed a data platform whose LLM agent answers questions in Arabic or English and stores bilingual metadata in the governance layer.",
    sources: ['voice-agent', 'contact-center', 'data-platform'],
  },
  {
    id: 'pii',
    keywords: ['pii', 'privacy', 'governance', 'compliance', 'ner', 'entity', 'personal data', 'sensitive', 'lineage', 'خصوصية', 'حوكمة', 'بيانات شخصية', 'امتثال'],
    strong: ['pii detection', 'data governance'],
    en: "At Governata I took personal-data detection accuracy from 26% to 92% by rebuilding the PII detection pipelines with NLP and ML across large enterprise datasets. Alongside that I automated foreign-key relationship mapping and data classification, and ran the full governance lifecycle — exploration, profiling, classification, lineage tracking and policy enforcement. A lot of the work was translating legal and regulatory requirements into auditable technical systems with legal, IT and business stakeholders in the room.",
  },
  {
    id: 'sql',
    keywords: ['sql', 'nl2sql', 'query', 'querying', 'text to sql', 'natural language', 'ask data', 'ask my data', 'dashboard', 'profiling', 'drift'],
    en: "My AI-Assisted Data Platform has an LLM agent with schema-grounded function calling: you ask a question in plain English or Arabic, it writes the SQL, runs it, and hands back the results plus analysis, charts, and the exact query it used — so the answer is auditable, not a black box. The same platform profiles messy uploads, diffs datasets across versions to flag statistically significant drift, and includes a self-serve chart builder.",
    sources: ['data-platform'],
  },
  {
    id: 'llm',
    keywords: ['llm', 'agent', 'agentic', 'rag', 'function calling', 'gpt', 'chatbot', 'genai', 'generative', 'prompt', 'evaluation', 'وكيل', 'نماذج لغوية', 'شات بوت', 'ذكاء توليدي'],
    en: "LLM engineering is my core. Agentic workflows, function calling and RAG in production — not demos. Concretely: a schema-grounded SQL agent, a voice agent that calls tools mid-conversation, personal analyst chatbots at REVEST, and LLM evaluation frameworks so model quality was measured rather than assumed. I work across OpenAI, Mistral, Gemini, HuggingFace, Ollama and Pydantic-AI.",
    sources: ['data-platform', 'voice-agent'],
  },
  {
    id: 'forecasting',
    keywords: ['forecast', 'time series', 'prophet', 'prediction', 'demand', 'sales', 'تنبؤ', 'سلاسل زمنية', 'توقع', 'مبيعات'],
    en: 'At REVEST I designed time series models for customer behaviour and sales forecasting, and built systems that analyse business inefficiencies, recommend strategies and evaluate ROI and long-term impact. I work with Prophet, TensorFlow and PyTorch, and my TensorFlow Developer Certificate specifically covers time series work alongside image processing and NLP.',
  },
  {
    id: 'engineering',
    keywords: ['etl', 'pipeline', 'data engineering', 'warehouse', 'kafka', 'airflow', 'microservice', 'integration', 'هندسة بيانات', 'خطوط', 'مستودع'],
    en: 'At INGOT Brokers I owned the core Python codebase for ETL and third-party integrations — APIs, cron jobs, transformations — across many sources, plus data warehousing, SQL transformations and dimensional modelling that automated reporting. I built microservices for real-time market analysis and led a rebuild of the data syncing technology that made it 70% faster and noticeably more stable.',
  },
  {
    id: 'fullstack',
    keywords: ['full stack', 'fullstack', 'frontend', 'backend', 'react', 'django', 'fastapi', 'next', 'web', 'api', 'واجهة', 'ويب', 'تطوير'],
    en: "The 'full-stack' part is literal — I ship the interface, not just the model. Django, Flask, FastAPI and Node.js on the backend; React, Next.js and TailwindCSS on the front; PostgreSQL, MySQL, MongoDB, ClickHouse and Redis underneath; AWS, Kafka and Redshift at scale. The Arabic contact centre portal is a good example: model, API, analytics suite and full RTL product UI, all mine.",
    sources: ['contact-center'],
  },
  {
    id: 'sentiment',
    keywords: ['sentiment', 'emotion', 'escalation', 'frustration', 'satisfaction', 'مشاعر', 'تصعيد', 'رضا', 'انفعال'],
    en: 'Sentiment shows up in three of my systems. The voice agent detects frustration inside the conversation loop and escalates. The contact centre platform prioritises the queue by sentiment and routes AI→human on sentiment, explicit request, or the AI hitting its confidence limit. And the call analytics platform scores emotional tone straight from the audio, not just the transcript.',
    sources: ['voice-agent', 'contact-center', 'call-analytics'],
  },
  {
    id: 'experience',
    keywords: ['experience', 'work', 'career', 'companies', 'where', 'worked', 'job', 'years', 'خبرة', 'شغل', 'وين', 'شركات', 'سنوات'],
    en: "Four stops so far. Freelance AI Consultant since April 2026, delivering four production systems across voice, data platforms and contact centre operations. Senior Data Scientist at Governata (Dec 2025 – Apr 2026), PII detection and data governance. Data Scientist at REVEST (Jan 2025 – Dec 2025), generative AI, forecasting and team mentoring. Data & Analytics Specialist at INGOT Brokers (Sep 2023 – Dec 2024), ETL, warehousing and real-time microservices.",
  },
  {
    id: 'education',
    keywords: ['education', 'degree', 'university', 'certificate', 'certified', 'study', 'studied', 'award', 'gpa', 'tensorflow', 'تعليم', 'شهادة', 'جامعة', 'دراسة', 'معدل', 'جائزة'],
    en: "I hold the TensorFlow Developer Certificate (2024), covering neural networks across image processing, time series and NLP. I studied Artificial Intelligence at Abdul Aziz Al Ghurair School of Advanced Computing — BTEC Level 5, ranked 1st, GPA 95.3% with distinction, and Student Ambassador. Jordan's Ministry of Higher Education recognised me as the top Jordanian student in AI. I also did a Python software development bootcamp at Code Fellows and Probability & Statistics from the University of London.",
  },
  {
    id: 'skills',
    keywords: [
      'skills',
      'tech stack',
      'tools',
      'technologies',
      'python',
      'java',
      'javascript',
      'database',
      'databases',
      'postgres',
      'mongodb',
      'clickhouse',
      'redis',
      'pytorch',
      'tensorflow',
    ],
    en: 'My languages are Python, Java and JavaScript. Voice/speech AI: STT, TTS, VAD. LLM orchestration: agentic workflows, function calling, RAG. NLP: NER and PII detection. ML/DL: TensorFlow, PyTorch, Scikit-learn, HuggingFace, Ollama, Pydantic-AI, Prophet, OpenAI, Mistral, Gemini. Web: Django, Flask, FastAPI, Node.js, React, Next.js, Tailwind. Databases: PostgreSQL, MySQL, MongoDB, ClickHouse, Redis, SQLite, DBT. Data engineering: ETL, modelling, governance, profiling, warehousing. Cloud: AWS, Kafka, Redshift.',
  },
  {
    id: 'hire',
    keywords: ['hire', 'hiring', 'available', 'contact', 'email', 'reach', 'freelance', 'consult', 'rate', 'work with', 'توظيف', 'تواصل', 'ايميل', 'متاحة', 'استشارة', 'اشتغل'],
    en: "I'm consulting freelance right now, so I'm open to conversations — full-time roles, consulting engagements, or a scoped build. The fastest way to reach me is email — Shadenshanab2@gmail.com — or call or text me on +962 79 891 8701. I'm based in Amman, Jordan and work comfortably in English and Arabic.",
  },
  {
    id: 'strengths',
    keywords: ['why', 'best', 'strength', 'good at', 'stand out', 'special', 'unique', 'ليش', 'لماذا', 'مميز', 'قوة', 'أفضل'],
    en: "The short version: I close the gap between a model and a product. Most people do one side. I do the research, the pipeline, the API, the UI and the deployment — and then measure whether it moved the business number. The 26%→92% and +70% figures on my CV exist because I stay with a system past the demo.",
  },
]

const fallbackEn =
  "That's not something I've put on my CV, so I'd rather not guess at it. Ask me instead about my voice agents, LLM and agentic systems, Arabic NLP, PII detection and data governance, forecasting, or data engineering — or reach me directly and ask in person: email Shadenshanab2@gmail.com, or call or text +962 79 891 8701."

export type Answer = { text: string; sources: string[]; matched: string }

/** Score a question against the intent keyword sets and return the best answer. */
export function answer(question: string): Answer {
  // Hyphens become spaces so "full-stack" matches the phrase "full stack".
  const q = question.toLowerCase().trim().replace(/[-_/]+/g, ' ')
  const qAr = normalizeAr(q)
  // Word tokens for English, so "hi" doesn't match inside "which".
  const tokens = q.split(/[^a-z0-9+#.]+/).filter(Boolean)

  const hits = (k: string) =>
    k.includes(' ') ? q.includes(k) : tokens.some((t) => t === k || (k.length >= 5 && t.startsWith(k)))

  let best: Intent | null = null
  let bestScore = 0

  for (const intent of intents) {
    let score = 0

    for (const raw of intent.keywords) {
      const k = raw.toLowerCase()
      if (isArabic(k)) continue // Arabic is handled by arRoots below
      if (!hits(k)) continue
      score += k.includes(' ') ? 4 : k.length >= 8 ? 4 : k.length >= 5 ? 2 : 1
    }

    for (const root of arRoots[intent.id] ?? []) {
      if (qAr.includes(normalizeAr(root))) score += 3
    }

    for (const s of intent.strong ?? []) {
      if (q.includes(s.toLowerCase())) score += 6
    }

    // Generic openers ("about", "tell me about", "حكيلي") only nudge, and only
    // once — otherwise "tell me about your voice work" scores the 'about' intent
    // (two opener hits) level with the real topic word and wins the tie.
    const weakHit =
      (intent.weak ?? []).some((w) => hits(w.toLowerCase())) ||
      (arWeak[intent.id] ?? []).some((w) => qAr.includes(normalizeAr(w)))
    if (weakHit) score += 1

    if (score > bestScore) {
      bestScore = score
      best = intent
    }
  }

  if (!best || bestScore < 1) {
    return { text: fallbackEn, sources: [], matched: 'none' }
  }

  return { text: best.en, sources: best.sources ?? [], matched: best.id }
}

export const suggestions = [
  { en: 'What voice AI have you built?', ar: null },
  { en: 'Walk me through the PII project', ar: null },
  { en: 'Can you do full-stack, or just models?', ar: null },
  { en: 'شو خبرتك بالذكاء الاصطناعي؟', ar: true },
  { en: 'Why should I hire you?', ar: null },
]
