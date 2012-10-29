var config = {
    STRIPE_PRIVATE_KEY: process.env.STRIPE_PRIVATE_KEY || "sk_test_Rtqdqmlu61z7TXB43Z5UpNGB",
    STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY || "pk_test_UISfg44mvvob3QnCVacGMQQc",
    DB_URL: process.env.DATABASE_URL || "tcp://postgres:1234@localhost/postgres"
};

config.templateData = {
    GA_ID: process.env.GA_ID || false,
    environment: process.env.NODE_ENV || 'development',
    FB_APP_ID: process.env.FB_APP_ID || "458521630865987",
    STRIPE_PUBLIC_KEY: config.STRIPE_PUBLIC_KEY
};

module.exports = config;
