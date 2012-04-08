(function() {
    "use strict";

    var mongoose = require('mongoose'),
    _      = require("underscore"),
    config = require("../config");
    mongoose.connect(config.mongodb.uri, function(err) {
      if(err) {
        throw err;
      }
      console.log('Connect call-back!');


      setTimeout(function() { startApp(); }, 5000);
    });


    var startApp = function() {

        var authServer     = require('.././authentication/auth-server').authServer();
        var feedbackServer = require('.././feedback/feedback-server').feedbackServer();
        var utils          = require('.././utils').sendEmailToUser;

        feedbackServer.getLeaderboard(false, function(user_scores) {
            _.each(user_scores, function(user, key, list) {
                var username = user.username,
                score   = user.score;
                feedbackServer.getLeaderboardForUser(username, function(user_stats) {
                    var rank = user_stats.rank,
                    diff = user_stats.diff;
                    authServer.getEmailAddressFromUsername(username, function(email_address) {
                        utils.sendEmailToUser(email_address, 'leaderboard_update', username, score, rank, diff);
                    });


                });
            });
        });

    };




} ());
