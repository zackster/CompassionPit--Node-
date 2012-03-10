(function() {
    "use strict";



    // var CONVERSATIONS_HISTORY = 180 * 24; // hours
    // var LOG_ENTRIES_HISTORY = 7 * 24; // hours
    // var CLIENT_ERRORS_HISTORY = 1; // hours
    var async = require('async');
    require('date-utils');
    var mongoose = require('mongoose'),
    config = require("../config");

    mongoose.connect(config.mongodb.uri);
    console.log(config.mongodb.uri);
    //    var Conversation = mongoose.model('Conversation', new mongoose.Schema({}));
    var LogEntries = mongoose.model('LogEntries', new mongoose.Schema({}));

    var connections = {};
    var disconnections = {};



    var grabConnections = function(callback) {
        LogEntries.find({
            action: 'connect'
        },
        ['userid', 'time'],
        function(err, docs) {
            if (err) {
                throw err;
            }
            if (docs) {
              for (var i in docs) {
                  var doc = docs[i];
                  var user_connects = connections[doc.userid] || [];
                  user_connects.push(doc.time);
                  connections[doc.userid] = user_connects;
              }
              console.log('connections: %s', connections);
              callback(null);
            }

        });
        console.log('grabbing connections');
    };

    var grabDisconnections = function(callback) {
      console.log('begin, next function.');
        LogEntries.find({
            action: 'disconnect'
        },
        ['userid', 'time'],
        function(err, docs) {
            if (err) {
                throw err;
            }
            if (docs) {
                for (var i in docs) {
                    var doc = docs[i];
                    var user_disconnects = disconnections[doc.userid] || (disconnections[doc.userid] = []);
                    user_disconnects.push(doc.time);

                }
                callback(null);
            }
        });
        console.log('grabbing disconnections');
    };

    var analyzeConnections = function(callback) {
        //do something later
        console.log('analyzing connections');
        callback(null);
    };

    var printResults = function(callback) {
        console.log(disconnections.length);
        console.log(connections.length);
        callback(null);
    };

    async.series([
      grabConnections,
      grabDisconnections,
      analyzeConnections,
      printResults
    ]);


} ());
