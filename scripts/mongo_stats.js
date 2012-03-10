(function () {
    "use strict";



    var CONVERSATIONS_HISTORY = 180 * 24; // hours
    var LOG_ENTRIES_HISTORY = 7 * 24; // hours
    var CLIENT_ERRORS_HISTORY = 1; // hours

    require('date-utils');
    var mongoose = require('mongoose'),
         config  = require("../config");

    mongoose.connect(config.mongodb.uri);
    console.log(config.mongodb.uri);
    var Conversation = mongoose.model('Conversation', new mongoose.Schema({}));
    var LogEntries   = mongoose.model('LogEntries', new mongoose.Schema({}));
    
    var connections = {};
    var disconnections = {};

    LogEntries.count({}, function(err,docs) {
      console.log(err);
      console.log(docs);
    });

    LogEntries.find({action:'connect'}, ['userid', 'time'], function(err, docs) {
            console.log('hi');
      if(err) {  throw err; }
      for(var i in docs) {
        var doc = docs[i];
        connections[doc.userid].push(doc.time);
      }
      console.log(connections.length);
    });
    
    LogEntries.findOne({action:'disconnect'}, ['userid', 'time'], function(err, docs) {
      console.log('hi');
      if(err) {  throw err; }              console.log('done');
      for(var i in docs) {
        var doc = docs[i];
        disconnections[doc.userid].push(doc.time);

      }
      console.log(disconnections.length);

    });
    


}());
