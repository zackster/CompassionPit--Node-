(function () {
    "use strict";

    var CONVERSATIONS_HISTORY = 30; // days
    var LOG_ENTRIES_HISTORY = 7; // days
    var CLIENT_ERRORS_HISTORY = 7; // days

    require('date-utils');
    var mongoose = require('mongoose'),
         config  = require("../config");

    mongoose.connect(config.mongodb.uri);

    var Conversation = mongoose.model('Conversation', new mongoose.Schema({}));
    var LogEntries   = mongoose.model('LogEntries', new mongoose.Schema({}));
    var ClientErrors = mongoose.model('ClientErrors', new mongoose.Schema({}));

    Conversation.remove({ finishTime: { $lt : (new Date()).add({ days: -1 * CONVERSATIONS_HISTORY }) }, finishReason : { $nin : [ "venterReportedAbuse", "listenerReportedAbuse" ] }  }, function (err) {
        if (err) {
            console.log(err.toString());
            process.exit(1);
        } else {
            LogEntries.remove({ time: { $lt : (new Date()).add({ days: -1 * LOG_ENTRIES_HISTORY}) } }, function (err) {
                if (err) {
                    console.log(err.toString());
                    process.exit(1);
                } else {
                    ClientErrors.remove({ time: { $lt : (new Date()).add({ days: -1 * CLIENT_ERRORS_HISTORY }) } }, function (err) {
                        if (err) {
                            console.log(err.toString());
                            process.exit(1);
                        } else {
                            process.exit(0);
                        }
                    });
                }
            });
        }
    });

}());
