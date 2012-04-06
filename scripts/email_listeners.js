(function() {
    "use strict";

	var feedbackServer;
    var mongoose = require('mongoose'),
    config = require("../config");
    mongoose.connect(config.mongodb.uri, function(err) {
      if(err) {
        throw err;
      }
      console.log('Connect call-back!');
    feedbackServer = require('.././feedback/feedback-server').feedbackServer();

      setTimeout(function() { startApp(); }, 5000);
    });


    var startApp = function() {

    feedbackServer.getLeaderboard(false, function(top15) {
			// console.log(top15);
      // if(username) {
      //   feedbackServer.getLeaderboardForUser(username, function(userStats) {
      //     // console.log("user stats", userStats);
      //       res.render('leaderboard', { scores: top15, username: username, userLeaderboard: userStats});
      //   });
      // }
      // else {
      //   res.render('leaderboard', { scores: top15, username: username });
      // }
    });

    };




} ());
