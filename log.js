(function () {
    "use strict";
    
    /*global console: false*/
    
    var config = require('./config');
    
    var mongoose = require('mongoose'),
        Schema = mongoose.Schema,
        ObjectId = Schema.ObjectId;
    
    mongoose.connect(config.mongodb.uri);
    
    console.log('connected to mongoose...');
    
    // TODO: write some merging app that will merge the LogEntries
    /**
     * Represents a single LogEntry that will be stored in MongoDB
     */
    mongoose.model('LogEntry', new Schema({
        userid: { type: String },
        action: { type: String, "enum": ['messageSent','connect','disconnect','joinRoom','leaveRoom'] },
        time: { type: Date, default: Date.now },
        count: { type: Number, default: 1 }
    }));
    var LogEntry = exports.LogEntry = mongoose.model('LogEntry');
    
    /**
     * Represents a single ClientError that will be stored in MongoDB
     */
    mongoose.model('ClientError', new Schema({
        message: { type: String },
        locationUrl: { type: String },
        userAgent: { type: String },
        errorUrl: { type: String },
        lineNumber: { type: Number },
        time: { type: Date, default: Date.now }
    }));
    var ClientError = exports.ClientError = mongoose.model('ClientError');
    
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

    exports.store = function (action, userid) {
        if (userid) {
          var entry = new LogEntry({
              action: action,
              userid: userid
          });
        }
        else {
          var entry = new LogEntry({
              action: action
          });
        }
        entry.save(function (err) {
            if (err) {
                exports.error({
                    event: "Cannot save LogEntry",
                    error: err.toString()
                });
            }
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
            var roomData = require('./rooms/models').Room.dumpData();
            var result = {
                entries: logEntries,
                counts: logCounts,
                rooms: roomData.rooms,
                listenerQueue: roomData.listenerQueue,
                venterQueue: roomData.venterQueue
            };
            ClientError.find({}, null, { sort: { time: -1 }, limit: 1000 }, function (err, errors) {
                if (err) {
                    throw err;
                }
                result.errors = errors;
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            });
        });
        
        app.post("/log-error", function (req, res) {
            var error = new ClientError({
                message: req.body.errorMsg,
                locationUrl: req.body.location,
                userAgent: req.headers['user-agent'],
                errorUrl: req.body.url,
                lineNumber: req.body.lineNumber,
            });
            error.save(function (err) {
                if (err) {
                    exports.error({
                        event: "Cannot save ClientError",
                        error: err.toString(),
                        body: JSON.stringify(req.body)
                    });
                }
            });
            res.send("");
        });
    };
    
    exports.info({
        event: "Server started"
    });
}());
