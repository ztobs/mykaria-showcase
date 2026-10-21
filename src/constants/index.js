/**
 * Application constants and configuration
 */

// Language constants
const LANGUAGES = {
  SUPPORTED_LANGUAGES: [
    "en",
    "de",
    "fr",
    "es",
    "it",
    "pt",
    "nl",
    "ru",
    "ja",
    "zh",
    "ko",
    "ar",
    "hi",
  ],
  DEFAULT_LANGUAGE: "en",
};

// Date formatting constants
const DATE_FORMATS = {
  en: {
    // English: "October 19, 2025"
    locale: "en-US",
    options: {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  },
  de: {
    // German: "19. Oktober 2025"
    locale: "de-DE",
    options: {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  },
  fr: {
    // French: "19 octobre 2025"
    locale: "fr-FR",
    options: {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  },
  es: {
    // Spanish: "19 de octubre de 2025"
    locale: "es-ES",
    options: {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  },
  it: {
    // Italian: "19 ottobre 2025"
    locale: "it-IT",
    options: {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  },
  pt: {
    // Portuguese: "19 de outubro de 2025"
    locale: "pt-PT",
    options: {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  },
  nl: {
    // Dutch: "19 oktober 2025"
    locale: "nl-NL",
    options: {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  },
  ru: {
    // Russian: "19 октября 2025 г."
    locale: "ru-RU",
    options: {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  },
  ja: {
    // Japanese: "2025年10月19日"
    locale: "ja-JP",
    options: {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  },
  zh: {
    // Chinese: "2025年10月19日"
    locale: "zh-CN",
    options: {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  },
  ko: {
    // Korean: "2025년 10월 19일"
    locale: "ko-KR",
    options: {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  },
  ar: {
    // Arabic: "١٩ أكتوبر ٢٠٢٥"
    locale: "ar-SA",
    options: {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  },
  hi: {
    // Hindi: "19 अक्टूबर 2025"
    locale: "hi-IN",
    options: {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  },
};

// Default recipient names by language
const DEFAULT_RECIPIENT_NAMES = {
  de: "Personalabteilung",
  fr: "Service du Personnel",
  es: "Departamento de Recursos Humanos",
  it: "Ufficio del Personale",
  pt: "Departamento de Recursos Humanos",
  nl: "Personeelsafdeling",
  ru: "Отдел кадров",
  ja: "人事部",
  zh: "人力资源部",
  ko: "인사부",
  ar: "قسم الموارد البشرية",
  hi: "मानव संसाधन विभाग",
};

// Default salutations by language (when no hiring manager name is found)
const DEFAULT_SALUTATIONS = {
  de: "Sehr geehrte Damen und Herren,",
  fr: "Madame, Monsieur,",
  es: "Estimados señores,",
  it: "Egregi signori,",
  pt: "Prezados senhores,",
  nl: "Geachte dames en heren,",
  ru: "Уважаемые дамы и господа,",
  ja: "拝啓", // Formal opening
  zh: "尊敬的招聘经理，", // Dear Hiring Manager
  ko: "안녕하세요,", // Hello
  ar: "السادة المحترمون،", // Dear Gentlemen
  hi: "प्रिय भर्ती प्रबंधक,", // Dear Hiring Manager
};

// Formal salutations by language (when full name is available)
const FORMAL_SALUTATIONS = {
  de: "Sehr geehrte/r {{name}},",
  fr: "Cher {{name}},",
  es: "Estimado/a {{name}},",
  it: "Egregio/a {{name}},",
  pt: "Prezado/a {{name}},",
  nl: "Geachte {{name}},",
  ru: "Уважаемый {{name}},",
  ja: "{{name}}様", // Name-sama (formal honorific)
  zh: "尊敬的{{name}}，", // Dear [Name]
  ko: "{{name}}님께,", // [Name]-nim (formal honorific)
  ar: "السيد/السيدة {{name}}،", // Mr./Mrs. [Name]
  hi: "प्रिय {{name}},", // Dear [Name]
};

// CV section headers by language
const CV_SECTION_HEADERS = {
  en: {
    professionalSummary: "Professional Summary",
    skills: "Skills",
    keyAchievements: "Key Achievements",
    experience: "Professional Experience",
    education: "Education",
    languages: "Languages",
    interests: "Interests & Causes",
    certifications: "Certifications",
    projects: "Key Projects",
    photo: "Photo",
    contact: "Contact",
    technologies: "Technologies:",
    present: "Present",
  },
  de: {
    professionalSummary: "Berufliche Zusammenfassung",
    skills: "Fähigkeiten",
    keyAchievements: "Wichtigste Erfolge",
    experience: "Berufserfahrung",
    education: "Ausbildung",
    languages: "Sprachen",
    interests: "Interessen & Engagement",
    certifications: "Zertifizierungen",
    projects: "Wichtige Projekte",
    photo: "Foto",
    contact: "Kontakt",
    technologies: "Technologien:",
    present: "heute",
  },
  fr: {
    professionalSummary: "Résumé Professionnel",
    skills: "Compétences",
    keyAchievements: "Réalisations Clés",
    experience: "Expérience Professionnelle",
    education: "Formation",
    languages: "Langues",
    interests: "Centres d'Intérêt & Engagements",
    certifications: "Certifications",
    projects: "Projets Clés",
    photo: "Photo",
    contact: "Contact",
    technologies: "Technologies :",
    present: "Aujourd'hui",
  },
  es: {
    professionalSummary: "Resumen Profesional",
    skills: "Habilidades",
    keyAchievements: "Logros Clave",
    experience: "Experiencia Profesional",
    education: "Educación",
    languages: "Idiomas",
    interests: "Intereses & Causas",
    certifications: "Certificaciones",
    projects: "Proyectos Clave",
    photo: "Foto",
    contact: "Contacto",
    technologies: "Tecnologías:",
    present: "Actualidad",
  },
  it: {
    professionalSummary: "Sintesi Professionale",
    skills: "Competenze",
    keyAchievements: "Risultati Principali",
    experience: "Esperienza Professionale",
    education: "Istruzione",
    languages: "Lingue",
    interests: "Interessi & Cause",
    certifications: "Certificazioni",
    projects: "Progetti Chiave",
    photo: "Foto",
    contact: "Contatto",
    technologies: "Tecnologie:",
    present: "Presente",
  },
  pt: {
    professionalSummary: "Resumo Profissional",
    skills: "Habilidades",
    keyAchievements: "Conquistas Principais",
    experience: "Experiência Profissional",
    education: "Educação",
    languages: "Idiomas",
    interests: "Interesses & Causas",
    certifications: "Certificações",
    projects: "Projetos Principais",
    photo: "Foto",
    contact: "Contato",
    technologies: "Tecnologias:",
    present: "Presente",
  },
  nl: {
    professionalSummary: "Professionele Samenvatting",
    skills: "Vaardigheden",
    keyAchievements: "Belangrijkste Prestaties",
    experience: "Werkervaring",
    education: "Opleiding",
    languages: "Talen",
    interests: "Interesses & Doelen",
    certifications: "Certificeringen",
    projects: "Belangrijke Projecten",
    photo: "Foto",
    contact: "Contact",
    technologies: "Technologieën:",
    present: "Heden",
  },
  ru: {
    professionalSummary: "Профессиональное резюме",
    skills: "Навыки",
    keyAchievements: "Ключевые Достижения",
    experience: "Профессиональный опыт",
    education: "Образование",
    languages: "Языки",
    interests: "Интересы & Причины",
    certifications: "Сертификаты",
    projects: "Ключевые проекты",
    photo: "Фото",
    contact: "Контакты",
    technologies: "Технологии:",
    present: "Настоящее время",
  },
  ja: {
    professionalSummary: "プロフェッショナルサマリー",
    skills: "スキル",
    keyAchievements: "主要な実績",
    experience: "職務経験",
    education: "学歴",
    languages: "言語",
    interests: "興味・関心事",
    certifications: "資格",
    projects: "主要プロジェクト",
    photo: "写真",
    contact: "連絡先",
    technologies: "使用技術:",
    present: "現在",
  },
  zh: {
    professionalSummary: "专业总结",
    skills: "技能",
    keyAchievements: "关键成就",
    experience: "专业经验",
    education: "教育背景",
    languages: "语言",
    interests: "兴趣与事业",
    certifications: "认证",
    projects: "关键项目",
    photo: "照片",
    contact: "联系方式",
    technologies: "技术:",
    present: "至今",
  },
  ko: {
    professionalSummary: "전문 요약",
    skills: "기술",
    keyAchievements: "주요 성과",
    experience: "전문 경력",
    education: "교육",
    languages: "언어",
    interests: "관심사 & 원인",
    certifications: "자격증",
    projects: "주요 프로젝트",
    photo: "사진",
    contact: "연락처",
    technologies: "기술:",
    present: "현재",
  },
  ar: {
    professionalSummary: "ملخص مهني",
    skills: "المهارات",
    keyAchievements: "الإنجازات الرئيسية",
    experience: "الخبرة المهنية",
    education: "التعليم",
    languages: "اللغات",
    interests: "الاهتمامات & القضايا",
    certifications: "الشهادات",
    projects: "المشاريع الرئيسية",
    photo: "صورة",
    contact: "معلومات الاتصال",
    technologies: "التقنيات:",
    present: "حتى الآن",
  },
  hi: {
    professionalSummary: "पेशेवर सारांश",
    skills: "कौशल",
    keyAchievements: "प्रमुख उपलब्धियाँ",
    experience: "पेशेवर अनुभव",
    education: "शिक्षा",
    languages: "भाषाएँ",
    interests: "रुचियाँ & कारण",
    certifications: "प्रमाणपत्र",
    projects: "मुख्य परियोजनाएँ",
    photo: "फोटो",
    contact: "संपर्क",
    technologies: "प्रौद्योगिकियाँ:",
    present: "वर्तमान",
  },
};

// Closing phrases by language
const CLOSING_PHRASES = {
  en: [
    "Sincerely,",
    "Best regards,",
    "Kind regards,",
    "Yours sincerely,",
    "With best regards,",
    "Yours truly,",
  ],
  de: ["Mit freundlichen Grüßen,"],
  fr: [
    "Cordialement,",
    "Sincèrement,",
    "Bien à vous,",
    "Respectueusement,",
    "Avec mes salutations distinguées,",
  ],
  es: [
    "Atentamente,",
    "Cordialmente,",
    "Sinceramente,",
    "Un saludo,",
    "Con mis mejores deseos,",
  ],
  it: [
    "Cordiali saluti,",
    "Distinti saluti,",
    "Sinceramente,",
    "Con i migliori saluti,",
    "Con stima,",
  ],
  pt: [
    "Atenciosamente,",
    "Cordialmente,",
    "Sinceramente,",
    "Com os melhores cumprimentos,",
    "Respeitosamente,",
  ],
  nl: [
    "Met vriendelijke groet,",
    "Hoogachtend,",
    "Vriendelijke groeten,",
    "Met de meeste hoogachting,",
    "Hartelijke groeten,",
  ],
  ru: [
    "С уважением,",
    "С наилучшими пожеланиями,",
    "Искренне Ваш,",
    "С почтением,",
    "Всего наилучшего,",
  ],
  ja: [
    "敬具", // Formal closing
    "以上", // End of letter
    "宜しくお願い申し上げます", // Please treat me favorably
    "拝啓", // Formal opening/closing
    "謹んで", // Respectfully
  ],
  zh: [
    "此致敬礼", // With best regards
    "敬上", // Respectfully yours
    "顺颂商祺", // Wishing you business success
    "谨启", // Sincerely
    "祝好", // Best wishes
  ],
  ko: [
    "감사합니다", // Thank you
    "진심을 담아", // Sincerely
    "건승을 빕니다", // Wishing you success
    "배상", // With respect
    "안녕히 계세요", // Goodbye (formal)
  ],
  ar: [
    "وتفضلوا بقبول فائق الاحترام", // Please accept my highest respect
    "مع أطيب التحيات", // With best regards
    "وتفضلوا بقبول فائق التقدير", // Please accept my highest appreciation
    "مع خالص الشكر", // With sincere thanks
    "وتفضلوا بقبول فائق الاحترام والتقدير", // Please accept my highest respect and appreciation
  ],
  hi: [
    "भवदीय", // Yours faithfully
    "आपका आभारी", // Gratefully yours
    "शुभकामनाओं सहित", // With best wishes
    "सादर", // Respectfully
    "धन्यवाद सहित", // With thanks
  ],
};

// Language proficiency labels — localized per output language
const LANGUAGE_PROFICIENCY = {
  en: {
    native: "Native",
    fluent: "Fluent",
    advanced: "Advanced",
    intermediate: "Intermediate",
    conversational: "Conversational",
    basic: "Basic",
  },
  de: {
    native: "Muttersprache",
    fluent: "Fließend",
    advanced: "Fortgeschritten",
    intermediate: "Mittelstufe",
    conversational: "Konversationssicher",
    basic: "Grundkenntnisse",
  },
  fr: {
    native: "Langue maternelle",
    fluent: "Courant",
    advanced: "Avancé",
    intermediate: "Intermédiaire",
    conversational: "Conversationnel",
    basic: "Débutant",
  },
  es: {
    native: "Nativo",
    fluent: "Fluido",
    advanced: "Avanzado",
    intermediate: "Intermedio",
    conversational: "Conversacional",
    basic: "Básico",
  },
  it: {
    native: "Madrelingua",
    fluent: "Fluente",
    advanced: "Avanzato",
    intermediate: "Intermedio",
    conversational: "Conversazionale",
    basic: "Base",
  },
  pt: {
    native: "Nativo",
    fluent: "Fluente",
    advanced: "Avançado",
    intermediate: "Intermédio",
    conversational: "Conversacional",
    basic: "Básico",
  },
  nl: {
    native: "Moedertaal",
    fluent: "Vloeiend",
    advanced: "Gevorderd",
    intermediate: "Gemiddeld",
    conversational: "Conversationeel",
    basic: "Basis",
  },
  ru: {
    native: "Родной",
    fluent: "Свободно",
    advanced: "Продвинутый",
    intermediate: "Средний",
    conversational: "Разговорный",
    basic: "Начальный",
  },
  ja: {
    native: "母語",
    fluent: "流暢",
    advanced: "上級",
    intermediate: "中級",
    conversational: "会話レベル",
    basic: "初級",
  },
  zh: {
    native: "母语",
    fluent: "流利",
    advanced: "高级",
    intermediate: "中级",
    conversational: "会话",
    basic: "基础",
  },
  ko: {
    native: "모국어",
    fluent: "유창함",
    advanced: "고급",
    intermediate: "중급",
    conversational: "회화",
    basic: "기초",
  },
  ar: {
    native: "اللغة الأم",
    fluent: "طلاقة",
    advanced: "متقدم",
    intermediate: "متوسط",
    conversational: "محادثة",
    basic: "أساسي",
  },
  hi: {
    native: "मातृभाषा",
    fluent: "धाराप्रवाह",
    advanced: "उन्नत",
    intermediate: "मध्यम",
    conversational: "बातचीत",
    basic: "आधारभूत",
  },
};

// Content validation constants
const CONTENT_VALIDATION = {
  CV_MIN_WORDS: 100,
  COVER_LETTER_MIN_WORDS: 150,
  COVER_LETTER_MAX_WORDS: 500,
  PLACEHOLDER_PATTERNS: [
    "[placeholder",
    "[insert",
    "your name here",
    "company name",
  ],
};

// LLM configuration constants
const LLM_CONFIG = {
  CV_GENERATION: {
    MAX_TOKENS: 12000,
    TEMPERATURE: 0.7,
  },
  COVER_LETTER_GENERATION: {
    MAX_TOKENS: 2000,
    TEMPERATURE: 0.7,
  },
  LANGUAGE_DETECTION: {
    MAX_TOKENS: 10,
    TEMPERATURE: 0.1,
  },
  HIRING_MANAGER_EXTRACTION: {
    MAX_TOKENS: 100,
    TEMPERATURE: 0.1,
  },
};

// LLM model constants
const LLM_MODELS = {
  ANTHROPIC: [
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
    { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet" },
    { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" },
    { id: "claude-2.1", name: "Claude 2.1" },
    { id: "claude-2.0", name: "Claude 2.0" },
    { id: "claude-instant-1.2", name: "Claude Instant 1.2" },
  ],
  OPENAI: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
    { id: "gpt-4", name: "GPT-4" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  ],
};

// Template constants
const TEMPLATES = {
  DEFAULT_CV: "cv_template_default",
  DEFAULT_COVER_LETTER: "cover_letter_template_default",
  TEMPLATES_DIR: "storage/templates",
};

// File type translations by language
const FILE_TYPE_TRANSLATIONS = {
  en: {
    cv: "CV",
    cover_letter: "Cover_Letter",
  },
  de: {
    cv: "Lebenslauf",
    cover_letter: "Anschreiben",
  },
  fr: {
    cv: "CV",
    cover_letter: "Lettre_de_Motivation",
  },
  es: {
    cv: "CV",
    cover_letter: "Carta_de_Presentacion",
  },
  it: {
    cv: "CV",
    cover_letter: "Lettera_di_Presentazione",
  },
  pt: {
    cv: "CV",
    cover_letter: "Carta_de_Apresentacao",
  },
  nl: {
    cv: "CV",
    cover_letter: "Sollicitatiebrief",
  },
  ru: {
    cv: "Резюме",
    cover_letter: "Сопроводительное_Письмо",
  },
  ja: {
    cv: "履歴書",
    cover_letter: "カバーレター",
  },
  zh: {
    cv: "简历",
    cover_letter: "求职信",
  },
  ko: {
    cv: "이력서",
    cover_letter: "자기소개서",
  },
  ar: {
    cv: "السيرة_الذاتية",
    cover_letter: "خطاب_التقديم",
  },
  hi: {
    cv: "बायोडाटा",
    cover_letter: "आवेदन_पत्र",
  },
};

// File management constants
const FILE_MANAGEMENT = {
  GENERATED_DIR: "storage/generated",
  UPLOADS_DIR: "storage/uploads",
  FILE_TYPES: {
    COVER_LETTER: "cover_letter",
    CV: "cv",
  },
  FILE_EXTENSIONS: {
    PDF: "pdf",
  },
  FILE_NAMING_PLACEHOLDERS: {
    COMPANY: "[company_name]",
    JOB: "[job_title]",
    TYPE: "[documment_type]",
    TIMESTAMP: "[timestamp]",
    RANDOM_NUMBER: "[random_number]",
    CANDIDATE: "[candidate_name]",
    LANGUAGE: "[language]",
  },
  DEFAULT_FILE_NAMING_PATTERN:
    "[company_name]_[job_title]_[documment_type]_[timestamp]",
};

// PDF generation constants
const PDF_GENERATION = {
  PAGE_FORMAT: "A4",
  MARGINS: {
    TOP: "0.5in",
    RIGHT: "0.7in",
    BOTTOM: "0.5in",
    LEFT: "0.7in",
  },
  WAIT_UNTIL: "networkidle0",
};

// Application status constants
const APPLICATION_STATUSES = {
  VALID_STATUSES: [
    'APPLIED',
    'SCREENING',
    'INTERVIEW_1',
    'INTERVIEW_2',
    'INTERVIEW_3',
    'INTERVIEW_4',
    'INTERVIEW_5',
    'OFFER',
    'REJECTED',
    'ARCHIVED',
    'WITHDRAWN',
    'ACCEPTED',
  ],
  DEFAULT_STATUS: 'APPLIED',
};

// Change log action constants
const CHANGELOG_ACTIONS = {
  CREATED: "created",
  UPDATED: "updated",
  DELETED: "deleted",
  STATUS_CHANGED: "status_changed",
  NOTES_ADDED: "notes_added",
  AI_QUESTION: "ask_ai",
  DOCUMENT_REGENERATED: "document_regenerated",
  FILE_UPLOADED: "file_uploaded",
  FILE_DELETED: "file_deleted",
  PROFILE_UPDATED: "profile_updated",
  COMPANY_RESEARCH_COMPLETED: "company_research_completed",
  COMPANY_RESEARCH_FAILED: "company_research_failed",
  VALID_ACTIONS: [
    "created",
    "updated",
    "deleted",
    "status_changed",
    "notes_added",
    "ask_ai",
    "document_regenerated",
    "file_uploaded",
    "file_deleted",
    "profile_updated",
    "company_research_completed",
    "company_research_failed",
  ],
};

module.exports = {
  LANGUAGES,
  DATE_FORMATS,
  DEFAULT_RECIPIENT_NAMES,
  DEFAULT_SALUTATIONS,
  FORMAL_SALUTATIONS,
  CLOSING_PHRASES,
  CV_SECTION_HEADERS,
  LANGUAGE_PROFICIENCY,
  CONTENT_VALIDATION,
  LLM_CONFIG,
  LLM_MODELS,
  TEMPLATES,
  FILE_TYPE_TRANSLATIONS,
  FILE_MANAGEMENT,
  PDF_GENERATION,
  APPLICATION_STATUSES,
  CHANGELOG_ACTIONS,
};
