(function () {
    "use strict";
    
    /*global console: false*/
    
    var config = require('./config');
    
    var logEntries = {};
    var logCounts = {};
    
    /**
     * Generate a function that will handle logging for specific severity
     */
    var makeLogFunction = function (severity) {
        var logEntriesForSeverity = logEntries[severity] = [];
        var logCountsForSeverity = logCounts[severity] = {};
        var limit = config.logLimits[severity] || 100;
        /**
         * Log a message
         */
        return function (message) {
            message.time = Date.now();
            logEntriesForSeverity.push(message);
            var event = message.event;
            logCountsForSeverity[event] = (logCountsForSeverity[event] || 0) + 1;
            while (logEntriesForSeverity.length > limit) {
                logEntriesForSeverity.shift();
            }
        };
    };
    
    exports.info = makeLogFunction("info");
    exports.warn = makeLogFunction("warn");
    exports.error = makeLogFunction("error");
    
    /**
     * Add URL actions to an express app
     */
    exports.addActions = function (app) {
        app.get("/logs", function (req, res) {
            res.render('logs', { logTypes: Object.keys(logEntries) });
        });
        
        app.get("/logs.json", function (req, res) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                entries: logEntries,
                counts: logCounts,
                rooms: require('./rooms/models').Room.dumpData()
            }));
        });
    };
    
    exports.info({
        event: "Server started"
    });
}());