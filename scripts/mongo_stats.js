(function () {
    "use strict";



    // var CONVERSATIONS_HISTORY = 180 * 24; // hours
    // var LOG_ENTRIES_HISTORY = 7 * 24; // hours
    // var CLIENT_ERRORS_HISTORY = 1; // hours

    require('date-utils');
    var mongoose = require('mongoose'),
         config  = require("../config");

    mongoose.connect(config.mongodb.uri);
    console.log(config.mongodb.uri);
//    var Conversation = mongoose.model('Conversation', new mongoose.Schema({}));
    var LogEntries   = mongoose.model('LogEntries', new mongoose.Schema({}));
    
    var connections = {};
    var disconnections = {};



    LogEntries.find({action:'connect'}, ['userid', 'time'], function(err, docs) {
      if(err) {  throw err; }
      for(var i in docs) {
        var doc = docs[i];
        connections[doc.userid].push(doc.time);
      }
    });
    
    LogEntries.findOne({action:'disconnect'}, ['userid', 'time'], function(err, docs) {
      if(err) {  throw err; }
      for(var i in docs) {
        var doc = docs[i];
        var user_disconnects = disconnections[doc.userid] || (disconnections[doc.userid]=[]);
        user_disconnects.push(doc.time);

      }
      console.log(disconnections.length);

    });
    


}());
