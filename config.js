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
        },
        forceLatency: 1000,
        systemPassword: "password",
        serveMerged: false
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
        },
        forceLatency: 0,
        systemPassword: "password",
        serveMerged: true
    }
};

module.exports = config[process.env.NODE_ENV || "development"];

module.exports.scripts = [
    "json2.js",
    "jquery-1.6.1.js",
    "jquery.jplayer.js",
    "socket.io.js",
    "comm.js",
    "chat.js",
    "index.js",
    "logs.js"
];
module.exports.styles = [
    "css/reset.css",
    "css/style.css"
];
