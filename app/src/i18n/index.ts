export type Lang = 'en' | 'uz' | 'ru';

export const LANGUAGES: Lang[] = ['en', 'uz', 'ru'];

// Native-name labels for the language picker.
export const LANGUAGE_LABELS: Record<Lang, string> = {
  en: 'English',
  uz: 'O‘zbekcha',
  ru: 'Русский',
};

interface Strings {
  tagline: string;
  chooseLanguage: string;
  devLogin: string;
  // Shown when the app is opened outside Telegram (§8.8 Mini App).
  openInTelegramTitle: string;
  openInTelegramBody: string;
  signingIn: string;
  greeting: (name: string) => string;
  /** Bixy's one-time self-introduction (Part 05 §7). Shown with the greeting
   *  (Part 07 §12 step 2) while the student has no `met_at` — it used to open
   *  the board's get-to-know-you, which now starts at the first question. */
  bixyIntro: string;
  /** Tap-anywhere hint under the greeting. */
  greetingContinue: string;
  boardPlaceholder: string;
  signOut: string;
  loading: string;
  // The first meeting (Part 05 §7) — now the get-to-know-you conversation only:
  // the introduction moved to the greeting (Part 07 §12). `meetOffer` leads the
  // first question; the five questions are each individually skippable.
  meetOffer: string;
  meetSkipAll: string;
  meetSkip: string;
  meetNext: string;
  meetDone: string;
  meetPlaceholder: string;
  meetQuestions: Record<'occupation' | 'study_place' | 'hobbies' | 'interests' | 'motivation', string>;
  // Study plan & dashboard (§8.12).
  welcomeBack: (name: string) => string;
  dashboardStat: (completed: number, total: number, level: string) => string;
  dashboardStart: string;
  continueQuestion: string;
  continueYes: string;
  continueNo: string;
  passedContinue: string;
  pathComplete: string;
  levelPlaced: (level: string) => string;
  toYourPlan: string;
  generatingLesson: string;
  // Home screen & navigation (Part 07 §9).
  homeTitle: string;
  homeLevelLabel: (level: string) => string;
  homeLevelHint: string;
  homeContinue: string;
  homeCardCurrent: string;
  homeCardPassed: string;
  homeCardUpcoming: string;
  allLevelsTitle: string;
  back: string;
  topicLocked: string;
  levelTopicCount: (completed: number, total: number) => string;
  comingSoon: string;
  /** The reveal headline (Part 07 §12): "Your level is" + the tier name. */
  revealLead: string;
  /** Tap-anywhere hint on the reveal screen, once its entrance animation settles. */
  revealContinue: string;
  // Failure handling (§8.10).
  offline: string;
  lessonTimeoutFailed: string;
  lessonFailed: string;
  noContent: string;
  tryAgain: string;
  loginFailed: string;
  planLoadFailed: string;
  // The single input (§8.5).
  inputPlaceholder: string;
  attachPhoto: string;
  detourReturn: string;
  reexplainNote: string;
  askOffTopic: string;
  imageTooLarge: string;
  imageUnsupported: string;
  imageUnreadable: string;
}

// UI chrome follows the selected app language (§8.7). Written board content stays
// English regardless — that's the target-language material, out of scope here.
export const strings: Record<Lang, Strings> = {
  en: {
    tagline: 'Learn English grammar on a live whiteboard.',
    chooseLanguage: 'Choose your language',
    devLogin: 'Dev sign-in (local only)',
    openInTelegramTitle: 'Open this app in Telegram',
    openInTelegramBody:
      'This app runs inside Telegram. Open it from the bot in Telegram to start learning.',
    signingIn: 'Signing you in…',
    greeting: (name) => `Hi, ${name} 👋`,
    bixyIntro:
      'I’m Bixy. I teach English grammar on a board: I’ll write, draw and talk you through a topic, and you can stop me any time to ask about it again.',
    greetingContinue: 'Tap to continue',
    boardPlaceholder: 'Your whiteboard will appear here.',
    signOut: 'Sign out',
    loading: 'Loading…',
    meetOffer: 'Before we start, tell me a little about yourself — so I can explain things in a way that fits you.',
    meetSkipAll: 'Skip for now',
    meetSkip: 'Skip',
    meetNext: 'Next',
    meetDone: 'Done',
    meetPlaceholder: 'Type your answer…',
    meetQuestions: {
      occupation: 'What do you do — work, study, something else?',
      study_place: 'Where do you usually study?',
      hobbies: 'What do you do for fun?',
      interests: 'Anything you’re really into at the moment?',
      motivation: 'And why are you learning English?',
    },
    welcomeBack: (name) => `Welcome back, ${name} 👋`,
    dashboardStat: (completed, total, level) => `${completed} of ${total} ${level} topics done`,
    dashboardStart: 'Continue on the board',
    continueQuestion: 'Ready to continue with your next topic?',
    continueYes: "Let's go",
    continueNo: 'Not now',
    passedContinue: 'Nice work — that one’s passed! Continue to the next topic?',
    pathComplete: 'You’ve finished every topic at your level 🎉',
    levelPlaced: (level) => `You’re placed at ${level}.`,
    toYourPlan: 'Go to your plan',
    generatingLesson: 'Preparing your lesson…',
    homeTitle: 'General English',
    homeLevelLabel: (level) => `${level} level`,
    homeLevelHint: 'Click to see the map of all topics',
    homeContinue: 'Tap to continue',
    homeCardCurrent: 'Current topic',
    homeCardPassed: 'Passed',
    homeCardUpcoming: 'Upcoming',
    allLevelsTitle: 'All levels',
    back: 'Back',
    topicLocked: 'Pass the current topic to open this one.',
    levelTopicCount: (completed, total) => `${completed} of ${total} topics done`,
    comingSoon: 'Coming soon',
    revealLead: 'Your level is',
    revealContinue: 'Tap to continue',
    offline: 'You’re offline. Reconnect and reload to continue.',
    lessonTimeoutFailed: 'Your lesson is taking too long to load. Please try again.',
    lessonFailed: 'Something went wrong preparing your lesson. Please try again.',
    noContent: 'I don’t have a lesson for that yet. Please try again.',
    tryAgain: 'Try again',
    loginFailed: 'Couldn’t sign you in. Please try again.',
    planLoadFailed: 'Couldn’t load your plan. Please try again.',
    inputPlaceholder: 'Ask for a topic, or about this lesson…',
    attachPhoto: 'Attach a photo',
    detourReturn: 'Back to your plan',
    reexplainNote: 'Here’s another way to look at it',
    askOffTopic: 'I don’t have information about that.',
    imageTooLarge: 'That image is too large — please choose a smaller one.',
    imageUnsupported: 'That file isn’t a supported image.',
    imageUnreadable: 'Couldn’t read that photo — please try another.',
  },
  uz: {
    tagline: 'Ingliz tili grammatikasini jonli doskada o‘rganing.',
    chooseLanguage: 'Tilni tanlang',
    devLogin: 'Dev kirish (faqat lokal)',
    openInTelegramTitle: 'Ilovani Telegramda oching',
    openInTelegramBody:
      'Bu ilova Telegram ichida ishlaydi. O‘rganishni boshlash uchun uni Telegramdagi botdan oching.',
    signingIn: 'Tizimga kiritilmoqda…',
    greeting: (name) => `Salom, ${name} 👋`,
    bixyIntro:
      'Men Bixy. Doskada ingliz tili grammatikasini o‘rgataman: mavzuni yozib, chizib va gapirib tushuntiraman, siz esa istagan payt to‘xtatib, qayta so‘rashingiz mumkin.',
    greetingContinue: 'Davom etish uchun bosing',
    boardPlaceholder: 'Doskangiz shu yerda paydo bo‘ladi.',
    signOut: 'Chiqish',
    loading: 'Yuklanmoqda…',
    meetOffer: 'Boshlashdan oldin o‘zingiz haqingizda biroz aytib bering — tushuntirishlarimni sizga moslashtiraman.',
    meetSkipAll: 'Hozircha o‘tkazib yuborish',
    meetSkip: 'O‘tkazib yuborish',
    meetNext: 'Keyingisi',
    meetDone: 'Tayyor',
    meetPlaceholder: 'Javobingizni yozing…',
    meetQuestions: {
      occupation: 'Nima bilan shug‘ullanasiz — ishlaysizmi, o‘qiysizmi?',
      study_place: 'Odatda qayerda shug‘ullanasiz?',
      hobbies: 'Bo‘sh vaqtingizda nima qilasiz?',
      interests: 'Hozir sizni nima juda qiziqtiryapti?',
      motivation: 'Ingliz tilini nima uchun o‘rganyapsiz?',
    },
    welcomeBack: (name) => `Xush kelibsiz, ${name} 👋`,
    dashboardStat: (completed, total, level) => `${level} darajasida ${total} tadan ${completed} ta mavzu tugallandi`,
    dashboardStart: 'Doskada davom etish',
    continueQuestion: 'Keyingi mavzuga o‘tishga tayyormisiz?',
    continueYes: 'Boshladik',
    continueNo: 'Hozir emas',
    passedContinue: 'Ajoyib — bu mavzu topshirildi! Keyingi mavzuga o‘tamizmi?',
    pathComplete: 'Darajangizdagi barcha mavzularni tugatdingiz 🎉',
    levelPlaced: (level) => `Siz ${level} darajasiga joylashtirildingiz.`,
    toYourPlan: 'Rejangizga o‘tish',
    generatingLesson: 'Darsingiz tayyorlanmoqda…',
    homeTitle: 'Umumiy ingliz tili',
    homeLevelLabel: (level) => `${level} daraja`,
    homeLevelHint: 'Barcha mavzular xaritasini ko‘rish uchun bosing',
    homeContinue: 'Davom etish uchun bosing',
    homeCardCurrent: 'Joriy mavzu',
    homeCardPassed: 'O‘tilgan',
    homeCardUpcoming: 'Keyingi',
    allLevelsTitle: 'Barcha darajalar',
    back: 'Orqaga',
    topicLocked: 'Buni ochish uchun joriy mavzuni tugating.',
    levelTopicCount: (completed, total) => `${total} mavzudan ${completed} tasi tugallandi`,
    comingSoon: 'Tez orada',
    revealLead: 'Sizning darajangiz',
    revealContinue: 'Davom etish uchun bosing',
    offline: 'Internet aloqasi yo‘q. Davom etish uchun qayta ulanib, sahifani yangilang.',
    lessonTimeoutFailed: 'Darsni yuklash juda uzoq davom etmoqda. Iltimos, qayta urinib ko‘ring.',
    lessonFailed: 'Darsni tayyorlashda xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.',
    noContent: 'Bu bo‘yicha hozircha darsim yo‘q. Iltimos, qayta urinib ko‘ring.',
    tryAgain: 'Qayta urinib ko‘rish',
    loginFailed: 'Kirib bo‘lmadi. Iltimos, qayta urinib ko‘ring.',
    planLoadFailed: 'Rejangizni yuklab bo‘lmadi. Iltimos, qayta urinib ko‘ring.',
    inputPlaceholder: 'Mavzu so‘rang yoki shu dars haqida so‘rang…',
    attachPhoto: 'Rasm biriktirish',
    detourReturn: 'Rejaga qaytish',
    reexplainNote: 'Keling, buni boshqacha ko‘rib chiqamiz',
    askOffTopic: 'Menda bu haqda ma’lumot yo‘q.',
    imageTooLarge: 'Bu rasm juda katta — kichikrog‘ini tanlang.',
    imageUnsupported: 'Bu fayl qo‘llab-quvvatlanadigan rasm emas.',
    imageUnreadable: 'Bu rasmni o‘qib bo‘lmadi — boshqasini sinab ko‘ring.',
  },
  ru: {
    tagline: 'Изучайте английскую грамматику на живой доске.',
    chooseLanguage: 'Выберите язык',
    devLogin: 'Dev-вход (только локально)',
    openInTelegramTitle: 'Откройте приложение в Telegram',
    openInTelegramBody:
      'Это приложение работает внутри Telegram. Откройте его через бота в Telegram, чтобы начать.',
    signingIn: 'Выполняется вход…',
    greeting: (name) => `Привет, ${name} 👋`,
    bixyIntro:
      'Я Бикси. Я объясняю английскую грамматику на доске: пишу, рисую и рассказываю, а вы в любой момент можете остановить меня и спросить ещё раз.',
    greetingContinue: 'Нажмите, чтобы продолжить',
    boardPlaceholder: 'Здесь появится ваша доска.',
    signOut: 'Выйти',
    loading: 'Загрузка…',
    meetOffer: 'Прежде чем начать, расскажите немного о себе — так я смогу объяснять понятнее именно для вас.',
    meetSkipAll: 'Пропустить пока',
    meetSkip: 'Пропустить',
    meetNext: 'Дальше',
    meetDone: 'Готово',
    meetPlaceholder: 'Напишите ответ…',
    meetQuestions: {
      occupation: 'Чем вы занимаетесь — работаете, учитесь?',
      study_place: 'Где вы обычно занимаетесь?',
      hobbies: 'Чем любите заниматься в свободное время?',
      interests: 'Что вас сейчас особенно увлекает?',
      motivation: 'И почему вы учите английский?',
    },
    welcomeBack: (name) => `С возвращением, ${name} 👋`,
    dashboardStat: (completed, total, level) => `Пройдено ${completed} из ${total} тем уровня ${level}`,
    dashboardStart: 'Продолжить на доске',
    continueQuestion: 'Готовы перейти к следующей теме?',
    continueYes: 'Поехали',
    continueNo: 'Не сейчас',
    passedContinue: 'Отлично — тема пройдена! Перейти к следующей?',
    pathComplete: 'Вы прошли все темы на своём уровне 🎉',
    levelPlaced: (level) => `Ваш уровень — ${level}.`,
    toYourPlan: 'К вашему плану',
    generatingLesson: 'Готовим ваш урок…',
    homeTitle: 'Общий английский',
    homeLevelLabel: (level) => `Уровень ${level}`,
    homeLevelHint: 'Нажмите, чтобы увидеть карту всех тем',
    homeContinue: 'Нажмите, чтобы продолжить',
    homeCardCurrent: 'Текущая тема',
    homeCardPassed: 'Пройдено',
    homeCardUpcoming: 'Впереди',
    allLevelsTitle: 'Все уровни',
    back: 'Назад',
    topicLocked: 'Пройдите текущую тему, чтобы открыть эту.',
    levelTopicCount: (completed, total) => `${completed} из ${total} тем пройдено`,
    comingSoon: 'Скоро',
    revealLead: 'Ваш уровень',
    revealContinue: 'Нажмите, чтобы продолжить',
    offline: 'Нет подключения к интернету. Переподключитесь и перезагрузите страницу, чтобы продолжить.',
    lessonTimeoutFailed: 'Урок загружается слишком долго. Пожалуйста, попробуйте ещё раз.',
    lessonFailed: 'При подготовке урока произошла ошибка. Пожалуйста, попробуйте ещё раз.',
    noContent: 'У меня пока нет урока по этой теме. Пожалуйста, попробуйте ещё раз.',
    tryAgain: 'Попробовать снова',
    loginFailed: 'Не удалось выполнить вход. Пожалуйста, попробуйте ещё раз.',
    planLoadFailed: 'Не удалось загрузить ваш план. Пожалуйста, попробуйте ещё раз.',
    inputPlaceholder: 'Спросите тему или задайте вопрос об уроке…',
    attachPhoto: 'Прикрепить фото',
    detourReturn: 'Вернуться к плану',
    reexplainNote: 'Вот другой взгляд на это',
    askOffTopic: 'У меня нет информации об этом.',
    imageTooLarge: 'Это изображение слишком большое — выберите поменьше.',
    imageUnsupported: 'Этот файл не является поддерживаемым изображением.',
    imageUnreadable: 'Не удалось прочитать это фото — попробуйте другое.',
  },
};
