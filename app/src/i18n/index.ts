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
  loginWithTelegram: string;
  devLogin: string;
  loginUnavailable: string;
  greeting: (name: string) => string;
  boardPlaceholder: string;
  signOut: string;
  loading: string;
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
  // Failure handling (§8.10).
  offline: string;
  lessonTimeoutFailed: string;
  lessonFailed: string;
  noContent: string;
  tryAgain: string;
  loginCancelled: string;
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
    loginWithTelegram: 'Log in with Telegram',
    devLogin: 'Dev sign-in (local only)',
    loginUnavailable:
      'Telegram login isn’t available yet — the app URL still needs to be registered with BotFather.',
    greeting: (name) => `Hi, ${name} 👋`,
    boardPlaceholder: 'Your whiteboard will appear here.',
    signOut: 'Sign out',
    loading: 'Loading…',
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
    offline: 'You’re offline. Reconnect and reload to continue.',
    lessonTimeoutFailed: 'Your lesson is taking too long to load. Please try again.',
    lessonFailed: 'Something went wrong preparing your lesson. Please try again.',
    noContent: 'I don’t have a lesson for that yet. Please try again.',
    tryAgain: 'Try again',
    loginCancelled: 'Sign-in was cancelled. Please try again.',
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
    loginWithTelegram: 'Telegram orqali kirish',
    devLogin: 'Dev kirish (faqat lokal)',
    loginUnavailable:
      'Telegram orqali kirish hozircha mavjud emas — ilova manzili BotFatherda ro‘yxatdan o‘tishi kerak.',
    greeting: (name) => `Salom, ${name} 👋`,
    boardPlaceholder: 'Doskangiz shu yerda paydo bo‘ladi.',
    signOut: 'Chiqish',
    loading: 'Yuklanmoqda…',
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
    offline: 'Internet aloqasi yo‘q. Davom etish uchun qayta ulanib, sahifani yangilang.',
    lessonTimeoutFailed: 'Darsni yuklash juda uzoq davom etmoqda. Iltimos, qayta urinib ko‘ring.',
    lessonFailed: 'Darsni tayyorlashda xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.',
    noContent: 'Bu bo‘yicha hozircha darsim yo‘q. Iltimos, qayta urinib ko‘ring.',
    tryAgain: 'Qayta urinib ko‘rish',
    loginCancelled: 'Kirish bekor qilindi. Iltimos, qayta urinib ko‘ring.',
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
    loginWithTelegram: 'Войти через Telegram',
    devLogin: 'Dev-вход (только локально)',
    loginUnavailable:
      'Вход через Telegram пока недоступен — URL приложения нужно зарегистрировать в BotFather.',
    greeting: (name) => `Привет, ${name} 👋`,
    boardPlaceholder: 'Здесь появится ваша доска.',
    signOut: 'Выйти',
    loading: 'Загрузка…',
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
    offline: 'Нет подключения к интернету. Переподключитесь и перезагрузите страницу, чтобы продолжить.',
    lessonTimeoutFailed: 'Урок загружается слишком долго. Пожалуйста, попробуйте ещё раз.',
    lessonFailed: 'При подготовке урока произошла ошибка. Пожалуйста, попробуйте ещё раз.',
    noContent: 'У меня пока нет урока по этой теме. Пожалуйста, попробуйте ещё раз.',
    tryAgain: 'Попробовать снова',
    loginCancelled: 'Вход отменён. Пожалуйста, попробуйте ещё раз.',
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
