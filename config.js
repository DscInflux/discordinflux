module.exports = {
  client: {
    clientID: '925740376948609034',
    token: process.env.token,
    secret: '',
  },
  database: {
    MONGODB_URI: ''
  },
  website: {
    SESSION_SECRET: '',
    callbackURL: 'https://www.discordinflux.xyz/auth/callback',
    main: 'https://dscinflux.xyz',
    url: 'https://discordinflux.xyz',
    port: '3000',
    RECAPTCHA_SITE_KEY: '',
    RECAPTCHA_SECRET_KEY: '',
  },
  user: {
    AdminUser: ['787241442770419722', '510065483693817867'],
    VerifiedUser: ['787241442770419722', '510065483693817867'],
    VerifiedDeveloper: ['787241442770419722', '510065483693817867'],
    Verifiedpartners: ['510065483693817867'],
    TestUser: ['787241442770419722', '510065483693817867'],
  },
  server: {
    guildID: '926866855128342588',
    channels: {
      reportlogs: '',
    },
  },
};
