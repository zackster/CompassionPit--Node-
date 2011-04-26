var config = {
    development: {
        port: 8000,
        nowjsPort: 8000,
        nowjsHost: "localhost",
        logLimits: {
            info: 1000,
            warn: 1000,
            error: 1000
        }
    },
    production: {
        port: 8000,
        nowjsPort: 80,
        nowjsHost: "compassionpit.com",
        logLimits: {
            info: 1000,
            warn: 1000,
            error: 1000
        }
    }
};

module.exports = config[process.env.NODE_ENV || "development"];