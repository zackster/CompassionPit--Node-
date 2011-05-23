(function () {
    "use strict";
    
    /*global console: false*/
    
    var config = require('./config');
    var mongodb = require('mongodb');
    
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

    var mongoServer = new mongodb.Server(config.mongodb.host, config.mongodb.port, {});
    var mongoDb = new mongodb.Db(config.mongodb.logDb, mongoServer, {});
    
    
    exports.info = makeLogFunction("info");
    exports.warn = makeLogFunction("warn");
    exports.error = makeLogFunction("error");

    exports.store = function(obj) { 
        mongoDb.open(function (error, client) {
            if (error) {
                console.warn("Could not connect to mongoDB @" + config.mongodb.host + ":" + config.mongodb.port + ". Error: " + error.message);
                return;
            }
            var collection = new mongodb.Collection(client, config.mongodb.logCollection);
            collection.insert(obj, {safe:true}, function(err, objects) {
                if (err) { 
                    console.warn(err.message);
                }
                if (err && err.message.indexOf('E11000 ') !== -1) {
                    console.warn("Entry was already entered int the db");   
                }
                mongoDb.close();
             });                       
        });
    };
    
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
