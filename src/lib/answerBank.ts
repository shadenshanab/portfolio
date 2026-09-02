/**
 * Local, client-side answer bank for the AI Twin.
 *
 * Phase 1 backend: no network, no cost, no downtime. Scores an incoming question
 * against keyword sets (English + Arabic) and returns the best-matching grounded answer.
 * Phase 2 swaps this for streaming HuggingFace responses via `src/lib/api.ts`,
 * keeping this file as the automatic fallback.
 */

export type Intent = {
  id: string
  keywords: string[]
  /** Extra weight for very specific terms. */
  strong?: string[]
  /** Generic openers ("about", "tell me about") — present but never decisive. */
  weak?: string[]
  en: string
  ar: string
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
    en: "Hey — I'm Shaden's AI twin. I know her CV inside out, so ask me anything about her work: voice agents, LLM systems, NLP and PII, data platforms, forecasting, or the teams she's built things with. I answer in English or Arabic.",
    ar: 'أهلاً! أنا التوأم الذكي لشادن. بعرف سيرتها المهنية كاملة، فاسألني عن شغلها: وكلاء الصوت، أنظمة الـLLM، الـNLP وكشف البيانات الشخصية، منصات البيانات، أو التنبؤ. بجاوب بالعربي أو الإنجليزي.',
  },
  {
    id: 'about',
    keywords: ['who', 'yourself', 'introduce', 'profile'],
    weak: ['about', 'background', 'summary', 'tell me about'],
    en: "Shaden is a senior full-stack data scientist based in Amman, Jordan. She builds production AI systems end to end — retail, fintech, SaaS and data governance. TensorFlow certified, and recognised by Jordan's Ministry of Higher Education as the country's top AI student in 2023. Her range covers ML pipelines, forecasting, LLM engineering, agentic AI and conversational systems — plus the full-stack work to actually ship them.",
    ar: 'شادن عالمة بيانات فُل ستاك من عمّان، الأردن. بتبني أنظمة ذكاء اصطناعي جاهزة للإنتاج من البداية للنهاية — في التجزئة والتكنولوجيا المالية والـSaaS وحوكمة البيانات. حاصلة على شهادة TensorFlow، ومكرّمة من وزارة التعليم العالي كأفضل طالبة ذكاء اصطناعي في الأردن سنة 2023. خبرتها بتغطي خطوط الـML والتنبؤ وهندسة الـLLM والذكاء الوكيلي وأنظمة المحادثة.',
  },
  {
    id: 'voice',
    keywords: ['voice', 'speech', 'stt', 'tts', 'call', 'audio', 'talk', 'agent', 'dialect', 'barge', 'صوت', 'صوتي', 'مكالمة', 'لهجة', 'نطق', 'كلام'],
    strong: ['voice-to-voice', 'voice agent', 'speech to text', 'text to speech'],
    en: "Voice is one of her strongest areas. She built an agentic voice-to-voice customer service agent: real-time speech-to-text, dialect-aware text-to-speech, and an LLM orchestration layer with function calling that performs live actions mid-call — database lookups, API calls, even call transfer. It classifies the caller's Arabic dialect and replies in that dialect rather than defaulting to MSA, uses voice activity detection with barge-in for natural turn-taking, and runs sentiment detection inside the loop to catch frustration and escalate. She also contributed to a call analytics platform that detects emotional tone from voice and writes Arabic quality reports.",
    ar: 'الصوت من أقوى مجالاتها. بنت وكيل خدمة عملاء صوت-لصوت: تحويل كلام لنص بالوقت الحقيقي، وتحويل نص لكلام واعي باللهجة، وطبقة تنسيق LLM مع استدعاء دوال بتنفّذ إجراءات حيّة أثناء المكالمة — استعلامات قواعد بيانات، استدعاءات API، وحتى تحويل المكالمة. النظام بيصنّف لهجة المتصل العربية وبيرد بنفس اللهجة مش بالفصحى، وبيستخدم كشف النشاط الصوتي مع المقاطعة لتبادل أدوار طبيعي، وبيرصد المشاعر داخل الحلقة عشان يكتشف الإحباط ويصعّد الحالة.',
    sources: ['voice-agent', 'call-analytics'],
  },
  {
    id: 'arabic',
    keywords: ['arabic', 'bilingual', 'dialects', 'msa', 'rtl'],
    strong: ['arabic'],
    en: "Arabic is native for her, and it shows up as real engineering rather than a checkbox. She's done Arabic dialect classification with dialect-matched generation for voice agents, built an entirely Arabic-language contact centre portal with RTL UX, shipped Arabic call-quality reporting, and designed a data platform whose LLM agent answers questions in Arabic or English and stores bilingual metadata in the governance layer.",
    ar: 'العربية لغتها الأم، وبتظهر كهندسة حقيقية مش كبند في السيرة الذاتية. عملت تصنيف للهجات العربية مع توليد ردود مطابقة للهجة في وكلاء الصوت، وبنت بوابة مركز اتصال بالكامل بالعربية مع تجربة RTL، وأطلقت تقارير جودة مكالمات بالعربي، وصمّمت منصة بيانات وكيلها الذكي بيجاوب بالعربي أو الإنجليزي ويخزّن بيانات وصفية ثنائية اللغة.',
    sources: ['voice-agent', 'contact-center', 'data-platform'],
  },
  {
    id: 'pii',
    keywords: ['pii', 'privacy', 'governance', 'compliance', 'ner', 'entity', 'personal data', 'sensitive', 'lineage', 'خصوصية', 'حوكمة', 'بيانات شخصية', 'امتثال'],
    strong: ['pii detection', 'data governance'],
    en: "At Governata she took personal-data detection accuracy from 26% to 92% by rebuilding the PII detection pipelines with NLP and ML across large enterprise datasets. Alongside that she automated foreign-key relationship mapping and data classification, and ran the full governance lifecycle — exploration, profiling, classification, lineage tracking and policy enforcement. A lot of the work was translating legal and regulatory requirements into auditable technical systems with legal, IT and business stakeholders in the room.",
    ar: 'في Governata، رفعت دقة كشف البيانات الشخصية من 26% إلى 92% عن طريق إعادة بناء خطوط كشف الـPII باستخدام الـNLP والتعلّم الآلي على بيانات مؤسسية ضخمة. وبالتوازي أتمتت رسم علاقات المفاتيح الأجنبية وتصنيف البيانات، ونفّذت دورة الحوكمة الكاملة — الاستكشاف والتوصيف والتصنيف وتتبّع المسار وفرض السياسات. جزء كبير من الشغل كان ترجمة المتطلبات القانونية والتنظيمية لأنظمة تقنية قابلة للتدقيق.',
  },
  {
    id: 'sql',
    keywords: ['sql', 'nl2sql', 'query', 'querying', 'text to sql', 'natural language', 'ask data', 'ask my data', 'dashboard', 'profiling', 'drift'],
    en: "Her AI-Assisted Data Platform has an LLM agent with schema-grounded function calling: you ask a question in plain English or Arabic, it writes the SQL, runs it, and hands back the results plus analysis, charts, and the exact query it used — so the answer is auditable, not a black box. The same platform profiles messy uploads, diffs datasets across versions to flag statistically significant drift, and includes a self-serve chart builder.",
    ar: 'منصة البيانات المدعومة بالذكاء الاصطناعي عندها وكيل LLM باستدعاء دوال مرتبط بالمخطط: بتسأل سؤال بالعربي أو الإنجليزي، بيكتب الـSQL، بينفّذها، وبيرجّعلك النتائج مع تحليل ورسومات والاستعلام نفسه — فالإجابة قابلة للتدقيق مش صندوق أسود. نفس المنصة بتوصّف الملفات الفوضوية، وبتقارن النسخ لرصد الانحراف الإحصائي، وفيها منشئ رسومات ذاتي الخدمة.',
    sources: ['data-platform'],
  },
  {
    id: 'llm',
    keywords: ['llm', 'agent', 'agentic', 'rag', 'function calling', 'gpt', 'chatbot', 'genai', 'generative', 'prompt', 'evaluation', 'وكيل', 'نماذج لغوية', 'شات بوت', 'ذكاء توليدي'],
    en: "LLM engineering is her core. Agentic workflows, function calling and RAG in production — not demos. Concretely: a schema-grounded SQL agent, a voice agent that calls tools mid-conversation, personal analyst chatbots at REVEST, and LLM evaluation frameworks so model quality was measured rather than assumed. She works across OpenAI, Mistral, Gemini, HuggingFace, Ollama and Pydantic-AI.",
    ar: 'هندسة الـLLM هي جوهر شغلها. سير عمل وكيلية، استدعاء دوال، وRAG في الإنتاج — مش مجرد عروض تجريبية. عمليًا: وكيل SQL مرتبط بالمخطط، وكيل صوتي بينادي أدوات أثناء المحادثة، شات بوتات محلل شخصي في REVEST، وأطر تقييم للنماذج اللغوية عشان تُقاس الجودة مش تُفترض. بتشتغل على OpenAI وMistral وGemini وHuggingFace وOllama وPydantic-AI.',
    sources: ['data-platform', 'voice-agent'],
  },
  {
    id: 'forecasting',
    keywords: ['forecast', 'time series', 'prophet', 'prediction', 'demand', 'sales', 'تنبؤ', 'سلاسل زمنية', 'توقع', 'مبيعات'],
    en: 'At REVEST she designed time series models for customer behaviour and sales forecasting, and built systems that analyse business inefficiencies, recommend strategies and evaluate ROI and long-term impact. She works with Prophet, TensorFlow and PyTorch, and the TensorFlow Developer Certificate specifically covers her time series work alongside image processing and NLP.',
    ar: 'في REVEST صمّمت نماذج سلاسل زمنية لسلوك العملاء والتنبؤ بالمبيعات، وبنت أنظمة بتحلّل أوجه القصور في الأعمال وبتوصي باستراتيجيات وبتقيّم العائد على الاستثمار والأثر بعيد المدى. بتشتغل بـProphet وTensorFlow وPyTorch، وشهادة TensorFlow بتغطي شغل السلاسل الزمنية تحديدًا.',
  },
  {
    id: 'engineering',
    keywords: ['etl', 'pipeline', 'data engineering', 'warehouse', 'kafka', 'airflow', 'microservice', 'integration', 'هندسة بيانات', 'خطوط', 'مستودع'],
    en: 'At INGOT Brokers she owned the core Python codebase for ETL and third-party integrations — APIs, cron jobs, transformations — across many sources, plus data warehousing, SQL transformations and dimensional modelling that automated reporting. She built microservices for real-time market analysis and led a rebuild of the data syncing technology that made it 70% faster and noticeably more stable.',
    ar: 'في INGOT Brokers كانت مسؤولة عن كود بايثون الأساسي لعمليات ETL والتكاملات مع أطراف ثالثة — APIs ومهام مجدولة وتحويلات — عبر مصادر متعددة، بالإضافة لمستودعات البيانات وتحويلات SQL والنمذجة البُعدية اللي أتمتت التقارير. بنت خدمات مصغّرة لتحليل السوق بالوقت الحقيقي، وقادت إعادة بناء تقنية مزامنة البيانات فصارت أسرع بنسبة 70% وأكثر استقرارًا.',
  },
  {
    id: 'fullstack',
    keywords: ['full stack', 'fullstack', 'frontend', 'backend', 'react', 'django', 'fastapi', 'next', 'web', 'api', 'واجهة', 'ويب', 'تطوير'],
    en: "The 'full-stack' part is literal — she ships the interface, not just the model. Django, Flask, FastAPI and Node.js on the backend; React, Next.js and TailwindCSS on the front; PostgreSQL, MySQL, MongoDB, ClickHouse and Redis underneath; AWS, Kafka and Redshift at scale. The Arabic contact centre portal is a good example: model, API, analytics suite and full RTL product UI, all hers.",
    ar: 'كلمة "فُل ستاك" حرفية عندها — بتطلّق الواجهة مش بس النموذج. Django وFlask وFastAPI وNode.js في الخلفية؛ React وNext.js وTailwind في الواجهة؛ PostgreSQL وMySQL وMongoDB وClickHouse وRedis تحتها؛ وAWS وKafka وRedshift على نطاق واسع. بوابة مركز الاتصال العربية مثال جيد: النموذج والـAPI وحزمة التحليلات وواجهة المنتج الكاملة بالـRTL، كلها من شغلها.',
    sources: ['contact-center'],
  },
  {
    id: 'sentiment',
    keywords: ['sentiment', 'emotion', 'escalation', 'frustration', 'satisfaction', 'مشاعر', 'تصعيد', 'رضا', 'انفعال'],
    en: 'Sentiment shows up in three of her systems. The voice agent detects frustration inside the conversation loop and escalates. The contact centre platform prioritises the queue by sentiment and routes AI→human on sentiment, explicit request, or the AI hitting its confidence limit. And the call analytics platform scores emotional tone straight from the audio, not just the transcript.',
    ar: 'تحليل المشاعر موجود في ثلاثة من أنظمتها. الوكيل الصوتي بيكتشف الإحباط داخل حلقة المحادثة وبيصعّد. ومنصة مركز الاتصال بترتّب أولويات الطابور حسب المشاعر وبتحوّل من الذكاء الاصطناعي للإنسان بناءً على المشاعر أو طلب صريح أو وصول النموذج لحد ثقته. ومنصة تحليل المكالمات بتقيّم النبرة العاطفية من الصوت نفسه مش بس من النص.',
    sources: ['voice-agent', 'contact-center', 'call-analytics'],
  },
  {
    id: 'experience',
    keywords: ['experience', 'work', 'career', 'companies', 'where', 'worked', 'job', 'years', 'خبرة', 'شغل', 'وين', 'شركات', 'سنوات'],
    en: 'Four stops so far. Freelance AI Consultant from April 2026, delivering four production systems across voice, data platforms and contact centre operations. Senior Data Scientist at Governata (Dec 2025 – Apr 2026), PII detection and data governance. Data Scientist at REVEST (Jan 2025 – Dec 2025), generative AI, forecasting and team mentoring. Data & Analytics Specialist at INGOT Brokers (Sep 2023 – Dec 2024), ETL, warehousing and real-time microservices.',
    ar: 'أربع محطات حتى الآن. مستشارة ذكاء اصطناعي مستقلة من نيسان 2026، وسلّمت أربعة أنظمة إنتاجية في الصوت ومنصات البيانات وعمليات مراكز الاتصال. عالمة بيانات أولى في Governata (كانون الأول 2025 – نيسان 2026) في كشف البيانات الشخصية والحوكمة. عالمة بيانات في REVEST (كانون الثاني – كانون الأول 2025) في الذكاء التوليدي والتنبؤ وإرشاد الفريق. أخصائية بيانات وتحليلات في INGOT Brokers (أيلول 2023 – كانون الأول 2024) في ETL والمستودعات والخدمات المصغّرة.',
  },
  {
    id: 'education',
    keywords: ['education', 'degree', 'university', 'certificate', 'certified', 'study', 'studied', 'award', 'gpa', 'tensorflow', 'تعليم', 'شهادة', 'جامعة', 'دراسة', 'معدل', 'جائزة'],
    en: 'TensorFlow Developer Certificate (2024), covering neural networks across image processing, time series and NLP. Artificial Intelligence at Abdul Aziz Al Ghurair School of Advanced Computing — BTEC Level 5, ranked 1st, GPA 95.3% with distinction, and Student Ambassador. Recognised by Jordan\'s Ministry of Higher Education as the top Jordanian student in AI. Plus a Python software development bootcamp at Code Fellows and Probability & Statistics from University of London.',
    ar: 'شهادة TensorFlow Developer (2024)، وبتغطي الشبكات العصبية في معالجة الصور والسلاسل الزمنية والـNLP. درست الذكاء الاصطناعي في أكاديمية عبد العزيز الغرير للحوسبة المتقدمة — BTEC المستوى الخامس، الأولى على دفعتها بمعدل 95.3% مع مرتبة امتياز، وسفيرة طلابية. ومكرّمة من وزارة التعليم العالي كأفضل طالبة أردنية في الذكاء الاصطناعي. بالإضافة لمعسكر تطوير برمجيات بايثون في Code Fellows، ومساق الاحتمالات والإحصاء من جامعة لندن.',
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
    en: 'Python, Java and JavaScript as languages. Voice/speech AI: STT, TTS, VAD. LLM orchestration: agentic workflows, function calling, RAG. NLP: NER and PII detection. ML/DL: TensorFlow, PyTorch, Scikit-learn, HuggingFace, Ollama, Pydantic-AI, Prophet, OpenAI, Mistral, Gemini. Web: Django, Flask, FastAPI, Node.js, React, Next.js, Tailwind. Databases: PostgreSQL, MySQL, MongoDB, ClickHouse, Redis, SQLite, DBT. Data engineering: ETL, modelling, governance, profiling, warehousing. Cloud: AWS, Kafka, Redshift.',
    ar: 'اللغات: بايثون وجافا وجافاسكربت. الذكاء الصوتي: STT وTTS وVAD. تنسيق الـLLM: سير عمل وكيلية واستدعاء دوال وRAG. الـNLP: التعرّف على الكيانات وكشف البيانات الشخصية. التعلّم الآلي والعميق: TensorFlow وPyTorch وScikit-learn وHuggingFace وOllama وPydantic-AI وProphet وOpenAI وMistral وGemini. الويب: Django وFlask وFastAPI وNode.js وReact وNext.js وTailwind. قواعد البيانات: PostgreSQL وMySQL وMongoDB وClickHouse وRedis. هندسة البيانات: ETL والنمذجة والحوكمة والتوصيف والمستودعات. السحابة: AWS وKafka وRedshift.',
  },
  {
    id: 'hire',
    keywords: ['hire', 'hiring', 'available', 'contact', 'email', 'reach', 'freelance', 'consult', 'rate', 'work with', 'توظيف', 'تواصل', 'ايميل', 'متاحة', 'استشارة', 'اشتغل'],
    en: "She's currently consulting freelance, so she's open to conversations — full-time roles, consulting engagements, or a scoped build. The fastest route is email: Shadenshanab2@gmail.com. She's based in Amman, Jordan and works comfortably in English and Arabic.",
    ar: 'حاليًا بتشتغل استشارات مستقلة، فهي منفتحة على النقاش — وظائف بدوام كامل، أو ارتباطات استشارية، أو مشروع محدّد النطاق. أسرع طريقة الإيميل: Shadenshanab2@gmail.com. مقيمة في عمّان، الأردن، وبتشتغل بالعربي والإنجليزي بكل ارتياح.',
  },
  {
    id: 'strengths',
    keywords: ['why', 'best', 'strength', 'good at', 'stand out', 'special', 'unique', 'ليش', 'لماذا', 'مميز', 'قوة', 'أفضل'],
    en: "The short version: she closes the gap between a model and a product. Most people do one side. She does the research, the pipeline, the API, the UI and the deployment — and then measures whether it moved the business number. The 26%→92% and +70% figures on her CV exist because she stays with a system past the demo.",
    ar: 'باختصار: بتسدّ الفجوة بين النموذج والمنتج. أغلب الناس بتعمل جهة وحدة. هي بتعمل البحث والخط والـAPI والواجهة والنشر — وبعدين بتقيس إذا فعلاً حرّك رقم الأعمال. أرقام 26%←92% و+70% موجودة في سيرتها لأنها بتضل مع النظام بعد العرض التجريبي.',
  },
]

const fallbackEn =
  "I only know what's on Shaden's CV, so I'd rather not guess at that one. Try me on her voice agents, LLM and agentic systems, Arabic NLP, PII detection and data governance, forecasting, data engineering, or how to get in touch.";
const fallbackAr =
  'بعرف بس اللي موجود في سيرة شادن الذاتية، وما بحب أخمّن. جرّب تسألني عن وكلاء الصوت، أنظمة الـLLM والوكيلية، الـNLP العربي، كشف البيانات الشخصية والحوكمة، التنبؤ، هندسة البيانات، أو طريقة التواصل معها.'

export type Answer = { text: string; sources: string[]; matched: string }

/** Score a question against the intent keyword sets and return the best answer. */
export function answer(question: string): Answer {
  // Hyphens become spaces so "full-stack" matches the phrase "full stack".
  const q = question.toLowerCase().trim().replace(/[-_/]+/g, ' ')
  const ar = isArabic(question)
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

    for (const w of intent.weak ?? []) {
      if (hits(w.toLowerCase())) score += 1
    }

    for (const root of arRoots[intent.id] ?? []) {
      if (qAr.includes(normalizeAr(root))) score += 3
    }

    for (const w of arWeak[intent.id] ?? []) {
      if (qAr.includes(normalizeAr(w))) score += 1
    }

    for (const s of intent.strong ?? []) {
      if (q.includes(s.toLowerCase())) score += 6
    }

    if (score > bestScore) {
      bestScore = score
      best = intent
    }
  }

  if (!best || bestScore < 1) {
    return { text: ar ? fallbackAr : fallbackEn, sources: [], matched: 'none' }
  }

  return { text: ar ? best.ar : best.en, sources: best.sources ?? [], matched: best.id }
}

export const suggestions = [
  { en: 'What voice AI has she built?', ar: null },
  { en: 'Walk me through the PII project', ar: null },
  { en: 'Can she do full-stack, or just models?', ar: null },
  { en: 'شو خبرتها بالذكاء الاصطناعي؟', ar: true },
  { en: 'Why should I hire her?', ar: null },
]
