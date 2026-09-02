/**
 * Single source of truth for the entire site.
 * Every section, the command palette and the AI twin read from here.
 * Update this file when the CV changes — nothing else should hold CV data.
 */

export const profile = {
  name: 'Shaden Shanab',
  first: 'SHADEN',
  last: 'SHANAB',
  title: 'Full-stack Data Scientist',
  subtitle: 'AI systems, end to end.',
  location: 'Amman, Jordan',
  email: 'Shadenshanab2@gmail.com',
  phone: '+962 79 891 8701',
  github: 'https://github.com/shadenshanab',
  linkedin: 'https://www.linkedin.com/in/shaden-shanab-480377194',
  cv: 'Shaden_Shanab.pdf',
  intro:
    'Senior full-stack data scientist building and shipping production-grade AI systems across retail, fintech, SaaS and data governance. I take things from a vague business pain all the way to a deployed system people actually use.',
  short:
    'I build AI systems end to end — voice agents, LLM orchestration, NLP pipelines and the data platforms underneath them.',
} as const

export const stats = [
  // ASCII arrow, not "→": Press Start 2P's diagonal arrowhead doesn't survive
  // hinting at this display's small pixel size, and "->" fits the terminal register anyway.
  { value: '26->92%', label: 'PII detection accuracy', note: 'at Governata' },
  { value: '+70%', label: 'data sync speed', note: 'at INGOT Brokers' },
  { value: '1st', label: 'in Jordan for AI', note: 'Ministry of Higher Education, 2023' },
  { value: '95.3%', label: 'GPA, distinction', note: 'ASAC, ranked 1st' },
] as const

export type Experience = {
  id: string
  period: string
  role: string
  company: string
  headline: string
  bullets: string[]
}

export const experience: Experience[] = [
  {
    id: 'freelance',
    period: 'Apr 2026 — Present',
    role: 'AI Consultant',
    company: 'Freelance',
    headline: 'Four production AI systems, four different industries.',
    bullets: [
      'Partner with businesses across retail, SaaS, marketing and customer experience to find the real pain point, design the AI solution, and deliver it end to end — architecture, LLM integration and deployment.',
      'Embed AI across business functions, from automating customer interactions to pulling actionable intelligence out of unstructured data, adapting each solution to the domain.',
    ],
  },
  {
    id: 'governata',
    period: 'Dec 2025 — Apr 2026',
    role: 'Senior Data Scientist',
    company: 'Governata',
    headline: 'Took PII detection from 26% to 92% accuracy.',
    bullets: [
      'Engineered end-to-end PII detection pipelines using NLP and ML across large-scale enterprise datasets, lifting accuracy from 26% to 92%.',
      'Built automated pipelines for foreign-key relationship mapping and data classification at enterprise scale.',
      'Ran the full data governance lifecycle: exploration, profiling, classification, lineage tracking and policy enforcement.',
      'Worked with legal, IT and business stakeholders to turn regulatory requirements into auditable technical systems.',
    ],
  },
  {
    id: 'revest',
    period: 'Jan 2025 — Dec 2025',
    role: 'Data Scientist',
    company: 'REVEST',
    headline: 'Ideation to deployment to measured impact.',
    bullets: [
      'Drove end-to-end development of AI solutions, from ideation and business analysis through prototyping, deployment and impact measurement.',
      'Designed ML, deep learning and generative AI applications — time series models for customer behaviour and sales forecasting, personal analyst chatbots, and LLM evaluation frameworks.',
      'Created systems that analyse business inefficiencies, recommend strategies, and evaluate ROI and long-term impact.',
      'Led and mentored the team while independently driving project foundations, strategy and execution.',
    ],
  },
  {
    id: 'ingot',
    period: 'Sep 2023 — Dec 2024',
    role: 'Data & Analytics Specialist',
    company: 'INGOT Brokers',
    headline: 'Rebuilt the data sync layer — 70% faster.',
    bullets: [
      'Built and maintained the core Python codebase for ETL and third-party integrations (APIs, cron jobs, transformations) across multiple data sources.',
      'Implemented ETL pipelines and data warehousing that improved operational efficiency and integration.',
      'Applied SQL transformations, dimensional modelling and preprocessing to automate reporting and dashboards.',
      'Developed microservices for real-time market analysis — extraction, transformation, validation and calculation.',
      'Led a transformation of the data syncing technology, increasing speed by 70% and improving stability.',
    ],
  },
]

export type Project = {
  id: string
  name: string
  kicker: string
  summary: string
  bullets: string[]
  stack: string[]
}

export const projects: Project[] = [
  {
    id: 'data-platform',
    name: 'AI-Assisted Data Platform',
    kicker: 'Data / Agents',
    summary:
      'Ingests messy datasets, profiles them, watches them drift, and lets anyone question them in plain English or Arabic.',
    bullets: [
      'Profiles raw uploads for completeness, type inference, distributions, duplicates and structural issues.',
      'Diffs datasets across uploads and flags statistically significant shifts and anomalies.',
      'Runs automated per-dataset and cross-dataset analysis, generating dashboards with plots and evidence for each finding.',
      'Self-serve chart and dashboard builder with metric-level comparison across datasets.',
      'LLM agent with schema-grounded function calling that turns natural-language questions (English or Arabic) into SQL, then returns results, analysis, charts and the query it used.',
      'Governance layer storing definitions, ownership, bilingual metadata and lineage attached to the schema.',
    ],
    stack: ['LLM function calling', 'NL→SQL', 'Profiling', 'Drift detection', 'Governance'],
  },
  {
    id: 'voice-agent',
    name: 'Voice-to-Voice Customer Service Agent',
    kicker: 'Voice / Agentic',
    summary:
      'A real-time spoken agent that understands Arabic dialects, answers in the same dialect, and takes live actions mid-call.',
    bullets: [
      'Agentic voice-to-voice pipeline combining real-time STT, dialect-aware TTS and an LLM orchestration layer.',
      'Function calling for live actions during the call — database lookups, API calls and call transfer.',
      'Arabic dialect classification and dialect-matched response generation, moving past MSA into natural regional speech.',
      'Voice activity detection and barge-in support for low-latency turn-taking.',
      'Sentiment detection inside the conversation loop to catch frustration and trigger escalation.',
    ],
    stack: ['STT', 'TTS', 'VAD', 'Dialect ID', 'Function calling'],
  },
  {
    id: 'contact-center',
    name: 'Contact Center Management Platform',
    kicker: 'Product / Arabic UX',
    summary:
      'An Arabic-language operations portal where AI and human agents share one queue, one pipeline and one set of numbers.',
    bullets: [
      'Unifies conversation management, claims, complaints, renewals and sales performance for agents and managers.',
      'Live conversation queue and kanban-style claims pipeline with AI and human lanes, sentiment-based prioritisation, and full case context for handoffs.',
      'Analytics suite tracking claim volume, sentiment, satisfaction, payments, renewals and sales conversion.',
      'AI-to-human escalation driven by customer sentiment, explicit request, or the AI hitting its confidence limit.',
    ],
    stack: ['Arabic RTL UI', 'Sentiment routing', 'Analytics', 'Human-in-the-loop'],
  },
  {
    id: 'call-analytics',
    name: 'Call Analytics Platform',
    kicker: 'Speech / Quality',
    summary:
      'Hears emotional tone in a call, scores service quality, and writes the report in Arabic before the agent hangs up.',
    bullets: [
      'AI-powered call analytics detecting emotional tone directly from voice.',
      'Automated service quality scoring across calls.',
      'Instant, detailed reports generated in Arabic.',
    ],
    stack: ['Speech emotion', 'Quality scoring', 'Arabic reporting'],
  },
]

export const skills = [
  { group: 'Voice & Speech AI', items: ['Speech-to-Text', 'Text-to-Speech', 'Voice Activity Detection'] },
  { group: 'LLM Orchestration', items: ['Agentic workflows', 'Function calling', 'RAG'] },
  { group: 'NLP', items: ['NLP', 'Named Entity Recognition', 'PII Detection'] },
  {
    group: 'ML & Deep Learning',
    items: ['TensorFlow', 'PyTorch', 'Scikit-learn', 'HuggingFace', 'Ollama', 'Pydantic-AI', 'Prophet', 'OpenAI', 'Mistral', 'Gemini'],
  },
  {
    group: 'Web Development',
    items: ['Django', 'Flask', 'FastAPI', 'Node.js', 'React', 'Next.js', 'REST API', 'TailwindCSS'],
  },
  { group: 'Databases', items: ['PostgreSQL', 'MySQL', 'MongoDB', 'ClickHouse', 'Redis', 'SQLite', 'DBT'] },
  {
    group: 'Data Engineering',
    items: ['ETL', 'Data Modeling', 'Data Governance', 'Data Profiling', 'Data Warehousing'],
  },
  { group: 'Big Data & Cloud', items: ['AWS', 'Kafka', 'Redshift'] },
  { group: 'Analytics & Viz', items: ['pandas', 'NumPy', 'Plotly', 'matplotlib', 'PowerBI', 'Excel'] },
  { group: 'Languages', items: ['Python', 'Java', 'JavaScript', 'Arabic (native)', 'English (fluent)'] },
] as const

export const proof = [
  {
    year: '2024',
    title: 'TensorFlow Developer Certificate',
    issuer: 'TensorFlow',
    note: 'Building and training neural networks across image processing, time series and NLP.',
  },
  {
    year: '2023',
    title: 'Top Jordanian Student in Artificial Intelligence',
    issuer: 'Ministry of Higher Education',
    note: 'National recognition as the top AI student in Jordan.',
  },
  {
    year: '2021—2023',
    title: 'Artificial Intelligence — Ranked 1st',
    issuer: 'Abdul Aziz Al Ghurair School of Advanced Computing (ASAC)',
    note: 'BTEC Level 5 Associate Degree. GPA 95.3%, distinction. Also served as Student Ambassador.',
  },
  {
    year: '2022—2023',
    title: 'Software Development in Python Bootcamp',
    issuer: 'Code Fellows',
    note: 'Intensive full-stack development, database programming and engineering practice.',
  },
  {
    year: '—',
    title: 'Probability and Statistics',
    issuer: 'University of London · Coursera',
    note: '',
  },
] as const

export const sections = [
  { id: 'top', label: 'Top', num: '00' },
  { id: 'twin', label: 'AI Twin', num: '01' },
  { id: 'work', label: 'Experience', num: '02' },
  { id: 'projects', label: 'Projects', num: '03' },
  { id: 'skills', label: 'Skills', num: '04' },
  { id: 'proof', label: 'Proof', num: '05' },
  { id: 'contact', label: 'Contact', num: '06' },
] as const
