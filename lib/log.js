(function() {

  (function() {
    "use strict";
    var ClientError, LogEntry, ObjectId, Schema, WaitTime, config, logCounts, logEntries, makeLogFunction, mongoose;
    config = require("./config");
    mongoose = require("mongoose");
    Schema = mongoose.Schema;
    ObjectId = Schema.ObjectId;
    mongoose.model("LogEntry", new Schema({
      userid: {
        type: String
      },
      action: {
        type: String,
        "enum": ["messageSent", "connect", "disconnect", "joinRoom", "leaveRoom"]
      },
      time: {
        type: Date,
        "default": Date.now
      },
      count: {
        type: Number,
        "default": 1
      }
    }));
    LogEntry = exports.LogEntry = mongoose.model("LogEntry");
    mongoose.model("WaitTime", new Schema({
      userid: {
        type: String
      },
      userType: {
        type: String
      },
      queuePosition: {
        type: Number
      },
      joinTime: {
        type: Number
      },
      currentTime: {
        type: Number,
        "default": new Date().getTime()
      }
    }));
    WaitTime = exports.WaitTime = mongoose.model("WaitTime");
    mongoose.model("ClientError", new Schema({
      message: {
        type: String
      },
      locationUrl: {
        type: String
      },
      userAgent: {
        type: String
      },
      errorUrl: {
        type: String
      },
      lineNumber: {
        type: Number
      },
      time: {
        type: Date,
        "default": Date.now
      }
    }));
    ClientError = exports.ClientError = mongoose.model("ClientError");
    logEntries = {};
    logCounts = {};
    makeLogFunction = function(severity) {
      var limit, logCountsForSeverity, logEntriesForSeverity;
      logEntriesForSeverity = logEntries[severity] = [];
      logCountsForSeverity = logCounts[severity] = {};
      limit = config.logLimits[severity] || 100;
      return function(message) {
        var event, _results;
        message.time = Date.now();
        logEntriesForSeverity.push(message);
        event = message.event;
        logCountsForSeverity[event] = (logCountsForSeverity[event] || 0) + 1;
        _results = [];
        while (logEntriesForSeverity.length > limit) {
          _results.push(logEntriesForSeverity.shift());
        }
        return _results;
      };
    };
    exports.info = makeLogFunction("info");
    exports.warn = makeLogFunction("warn");
    exports.error = makeLogFunction("error");
    exports.store = function(action, userid) {
      var entry;
      if (userid) {
        entry = new LogEntry({
          action: action,
          userid: userid
        });
      } else {
        entry = new LogEntry({
          action: action
        });
      }
      return entry.save(function(err) {
        if (err) {
          return exports.error({
            event: "Cannot save LogEntry",
            error: err.toString()
          });
        }
      });
    };
    exports.logWaitTime = function(waiter_info) {
      var wait_time;
      wait_time = new WaitTime({
        userId: waiter_info.userid,
        userType: waiter_info.user_type,
        queuePosition: waiter_info.queue_position,
        joinTime: waiter_info.join_time,
        currentTime: waiter_info.current_time
      });
      return wait_time.save(function(err) {
        if (err) {
          return exports.error({
            event: "Cannot save WaitTime",
            error: err.toString()
          });
        }
      });
    };
    exports.addActions = function(app) {
      app.get("/logs", function(req, res) {
        return res.render("logs", {
          logTypes: Object.keys(logEntries)
        });
      });
      app.get("/logs.json", function(req, res) {
        var result, roomData;
        roomData = require("./rooms/models").Room.dumpData();
        result = {
          entries: logEntries,
          counts: logCounts,
          rooms: roomData.rooms,
          listenerQueue: roomData.listenerQueue,
          venterQueue: roomData.venterQueue
        };
        return ClientError.find({}, null, {
          sort: {
            time: -1
          },
          limit: 1000
        }, function(err, errors) {
          if (err) throw err;
          result.errors = errors;
          res.writeHead(200, {
            "Content-Type": "application/json"
          });
          return res.end(JSON.stringify(result));
        });
      });
      return app.post("/log-error", function(req, res) {
        var error;
        error = new ClientError({
          message: req.body.errorMsg,
          locationUrl: req.body.location,
          userAgent: req.headers["user-agent"],
          errorUrl: req.body.url,
          lineNumber: req.body.lineNumber
        });
        error.save(function(err) {
          if (err) {
            return exports.error({
              event: "Cannot save ClientError",
              error: err.toString(),
              body: JSON.stringify(req.body)
            });
          }
        });
        return res.send("");
      });
    };
    return exports.info({
      event: "Server started"
    });
  })();

}).call(this);
