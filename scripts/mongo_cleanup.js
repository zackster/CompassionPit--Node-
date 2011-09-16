(function () {
    "use strict";

    require('date-utils');
    var mongoose = require('mongoose'),
         config  = require("../config");

    mongoose.connect(config.mongodb.uri);

    var Conversation = mongoose.model('Conversation', new mongoose.Schema({}));
    var LogEntries   = mongoose.model('LogEntries', new mongoose.Schema({}));
    var ClientErrors = mongoose.model('ClientErrors', new mongoose.Schema({}));
    var startTime = (new Date()).add({ days: -30 });

    Conversation.remove({ finishTime: { $lt : startTime }, finishReason : { $nin : [ "venterReportedAbuse", "listenerReportedAbuse" ] }  }, function (err) {
        if (err) {
            console.log(err.toString());
            process.exit(1);
        } else {
            LogEntries.remove({ time: { $lt : startTime } }, function (err) {
                if (err) {
                    console.log(err.toString());
                    process.exit(1);
                } else {
                    ClientErrors.remove({ time: { $lt : startTime } }, function (err) {
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
