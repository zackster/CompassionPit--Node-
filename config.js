var config = {
    development: {
        port: 8000,
        nowjsPort: 8000,
        nowjsHost: "localhost",
        mongodb: { 
            host: "localhost",
            port: "27017",
            logDb: "log-d",
            logCollection: "logs"   
        },
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
        mongodb: { 
            host: "localhost",
            port: "27017",
            logDb: "log-p",
            logCollection: "logs"    
        },
        logLimits: {
            info: 1000,
            warn: 1000,
            error: 1000
        }
    }
};

module.exports = config[process.env.NODE_ENV || "development"];
