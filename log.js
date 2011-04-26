(function () {
    "use strict";
    
    /*global console: false*/
    
    var config = require('./config');
    
    var logsByType = {};
    
    var makeLogFunction = function (severity) {
        var logs = logsByType[severity] = [];
        var limit = config.logLimits[severity] || 100;
        return function (message) {
            message.time = Date.now();
            logs.push(message);
            while (logs.length > limit) {
                logs.shift();
            }
        };
    };
    
    exports.info = makeLogFunction("info");
    exports.warn = makeLogFunction("warn");
    exports.error = makeLogFunction("error");
    
    exports.addActions = function (app) {
        app.get("/logs", function (req, res) {
            res.render('logs', { logTypes: Object.keys(logsByType) });
        });
        
        app.get("/logs.json", function (req, res) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(logsByType));
        });
    };
    
    exports.info({
        event: "Server started"
    });
}());