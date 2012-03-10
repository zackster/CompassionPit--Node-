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
    var LogEntries = mongoose.model('LogEntries', new mongoose.Schema({
      userid: { type: String },
      time: { type: Date }
    }));

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
              var doc;
              for (var i in docs) {
                  doc = docs[i];
                  var user_connects = connections[doc.userid] ? connections[doc.userid] : [];
                  user_connects.push(doc.time.toString());
                  connections[doc.userid] = user_connects;
              }
              console.log('connections');
              console.log(connections.length);
              callback(null);
            }

        });
    };

    var grabDisconnections = function(callback) {
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
                console.log(disconnections.length);
                callback(null);
            }
        });
    };

    var analyzeConnections = function(callback) {
        //do something later
        console.log('analyzing connections');
        callback(null);
    };

    var printResults = function(err, result) {
        console.log(result);
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
