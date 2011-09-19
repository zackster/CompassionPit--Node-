(function () {
    "use strict";

    var CONVERSATIONS_HISTORY = 180 * 24; // hours
    var LOG_ENTRIES_HISTORY = 7 * 24; // hours
    var CLIENT_ERRORS_HISTORY = 1; // hours

    require('date-utils');
    var mongoose = require('mongoose'),
         config  = require("../config");

    mongoose.connect(config.mongodb.uri);

    var Conversation = mongoose.model('Conversation', new mongoose.Schema({}));
    var LogEntries   = mongoose.model('LogEntries', new mongoose.Schema({}));
    var ClientErrors = mongoose.model('ClientErrors', new mongoose.Schema({}));

    Conversation.remove({ finishTime: { $lt : (new Date()).add({ hours: -1 * CONVERSATIONS_HISTORY }) }, finishReason : { $nin : [ "venterReportedAbuse", "listenerReportedAbuse" ] }  }, function (err) {
        if (err) {
            console.log(err.toString());
            process.exit(1);
        } else {
            LogEntries.remove({ time: { $lt : (new Date()).add({ hours: -1 * LOG_ENTRIES_HISTORY}) } }, function (err) {
                if (err) {
                    console.log(err.toString());
                    process.exit(1);
                } else {
                    ClientErrors.remove({ time: { $lt : (new Date()).add({ hours: -1 * CLIENT_ERRORS_HISTORY }) } }, function (err) {
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
