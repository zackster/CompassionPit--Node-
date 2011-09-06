/*jshint devel: true */

(function () {
    "use strict";
    
    var log = require("../log"),
        config = require("../config");
    
    var mongoose = require('mongoose');
    (function () {
        var Schema = mongoose.Schema;
        mongoose.model('Abuser', new Schema({
            hashedIPAddress: { type: String },
            banned: { type: Boolean },
            referrers: [],
            conversations: []
        }));
        mongoose.model('Conversation', new Schema({})); // read only, so no validation needed
    }());

    var Abuser = exports.Abuser = mongoose.model('Abuser');
    var Conversation = exports.Conversation = mongoose.model('Conversation');

    var Abuse = exports.Abuse = {};

    Abuse.getAllAbusers = function (callback) {
        Abuser.find({banned: { $ne: true }}, null, {}, function (err, abusers) {
            if (err) {
                log.error({
                    event: "Cannot retrieve abusers list",
                    error: err.toString()
                });
            } else {
                callback(abusers);
            }
        });
    };

    Abuse.getAbuser = function (abuserHashedIPAddress, callback) {
        Abuser.find({hashedIPAddress: abuserHashedIPAddress}, function (err, abusers) {
            if (err) {
                log.error({
                    event: "Cannot get abuser",
                    error: err.toString()
                });
            } else {
                callback(abusers[0]);
            }
        });
    };

    Abuse.banAbuser = function (abuserHashedIPAddress, callback) {
        Abuser.update({hashedIPAddress: abuserHashedIPAddress}, { banned: true }, {},  function (err) {
            if (err) {
                log.error({
                    event: "Cannot ban abuser",
                    error: err.toString()
                });
            } else {
                callback(true);
            }
        });
    };

    Abuse.getConversations = function (abuserHashedIPAddress, callback) {
        Abuse.getAbuser(abuserHashedIPAddress, function (abuser) {
            if (abuser && abuser.conversations) {
                Conversation.find({_id: { $in : abuser.conversations }}, function (err, conversations) {
                    if (err) {
                        log.error({
                           event: "Cannot retrieve conversation list",
                           error: err.toString()
                        });
                    } else {
                        // returning array results in single (first) conversation returned ?!?!
                        callback({ conversations: conversations, banned: abuser.banned }); 
                    }
                });
            }
        });
    };

    Abuse.removeConversation = function (data, callback) {
        Abuse.getAbuser(data.abuserHashedIPAddress, function (abuser) {
            // does not work !!!
            // abuser.conversations.$pull(data.conversationId);
            var newConversations = [];
            for (var i = 0; i < abuser.conversations.length; i++) {
                if (abuser.conversations[i] != data.conversationId) {
                    console.log(abuser.conversations[i].toString());
                    newConversations.push(abuser.conversations[i].toString());
                }
            }
            abuser.conversations = newConversations;
            abuser.save(function (err) {
                if (err) {
                    log.error({
                        event: "Cannot remove conversation from abuser",
                        error: err.toString()
                    });
                } else {
                    callback(true);
                }
            });
        });
    };

}());