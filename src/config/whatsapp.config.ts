export const whatsappConfig = {
  authStrategy: {
    clientId: 'jarvis-bot-nourx',
    dataPath: './.wwebjs_auth/',
  },
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
    ],
    ...(process.env.PUPPETEER_EXECUTABLE_PATH && { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }),
  },
  qrMaxRetries: 5,
  takeoverOnConflict: true,
  takeoverTimeoutMs: 0,
};