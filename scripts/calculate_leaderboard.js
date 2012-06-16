(function () {

  "use strict";
  var mongoose       = require('mongoose'),
    _ = require('underscore'),
    regexp = require(".././utils").regexp,
    Schema = mongoose.Schema,
    Feedback = mongoose.model('Feedback', new Schema({
                            listener:     {
                                            type:       String,
                                            validate:   [function(str) { return str.length>0; }]
                                          },
                            venter:       {
                                            type:       String,
                                            validate:   [function(str) { return str.length>0; }]
                                          },
                            direction:    {
                                            type:       String,
                                            validate:   [function(str) { return (str === 'positive' || str === 'negative'); }]
                                          },
                            ipAddress:    {
                                            type:       String
                                          } // later we can add in a validate: function, to ensure it's a proper ip address.
                                  }));



  var Server = function() {

    var self = this;
    self.listenerScores = {};

   this.calculateLeaderboard = function(callback) {
      console.log("We are calculating the leaderboard.");
      Feedback.distinct('listener', {
          listener: {
              $exists: true
          }
      },
      function(err, listeners, callback) { // we have a list of distinct listeners
          if (err) {
              console.log("Error! " + err);
              return;
          }
		  var posStep = 0;
		  var negStep = 0;
          for (var i in listeners) { // for each listener ...

            if(listeners.hasOwnProperty(i)) {

              (function(thisListener) {

                Feedback.count({
                    listener: thisListener,
                    direction: 'positive'
                },
                function(err, docs) {
                    if (err) {
                        console.log("error! " + err);
                        return;
                    }
                    self.listenerScores[thisListener] = (self.listenerScores[thisListener] || 0) + (1 * docs);
					posStep+=1;
					if(posStep===listeners.length && negStep===listeners.length) {
						callback(true);
					}
                });

                Feedback.count({
                    listener: thisListener,
                    direction: 'negative'
                },
                function(err, docs) {
                    if (err) {
                        console.log("error! " + err);
                        return;
                    }
                    self.listenerScores[thisListener] = (self.listenerScores[thisListener] || 0) + (-1 * docs);
					negStep+=1;
					if(posStep===listeners.length && negStep===listeners.length) {
						callback(true);
					}
                });

              }(listeners[i]));
            }

          }
      });
  };


    this.getLeaderboardForUser = function(loggedInUser, cb) {
      // console.log("glfu");
      var scores = self.listenerScores;
	  // console.log("scores,", scores);
      var user_scores = [];
      _.each(scores, function(score, username, list) {

        if(username.length !== 24 && !regexp().email.test(username)) {
          var valid_user = {username: username, score: score};
          user_scores.push(valid_user);
        }
      });
      // console.log("uzer scores", user_scores);
      var user_scores_sorted = _.sortBy(user_scores, function(user_to_sort, position, list) {
        // console.log("uzer, ", user_to_sort);
        return -user_to_sort.score; // sortBy sorts by value returned in descending order
      });
      // console.log("user scores sorted", user_scores_sorted);
      var user_position = -1;
      _.each(user_scores_sorted, function(user, position, list) {
        // console.log("username being eached", user.username);
        // console.log("our user", loggedInUser);
        if(user.username === loggedInUser) {
          user_position = position + 1;
        }
      });


      var diff_needed_to_move_up = 'N/A :)';
      if(user_position !== -1) { // user is on leaderboard
        // console.log("user position", user_position);
        var logged_in_user_score = user_scores_sorted[user_position-1].score;
        for(var i=user_position-2; i>=0; i-=1) {
          // console.log("user scores", user_scores_sorted);
          // console.log("i", i);
          // console.log("user scores i", user_scores_sorted[i]);
          if(user_scores_sorted[i].score > logged_in_user_score) {
            diff_needed_to_move_up = user_scores_sorted[i].score - logged_in_user_score;
            break;
          }
        }
		// console.log('calling callback');
        cb.call(null, {
          rank: user_position,
          score: logged_in_user_score,
          diff: diff_needed_to_move_up
        });
        return;
      }
      else {
		// console.log('calling callback');
        cb.call(null, {
          rank: 'Not On Leaderboard',
          score: 'No Score',
          diff: 'N/A'
        });
      }

    };

    this.getLeaderboard = function(top15Only, cb) {

      var scores = self.listenerScores;
      var user_scores = [];
      _.each(scores, function(score, username, list) {

        if(username.length !== 24 && !regexp().email.test(username)) {
          var user = {username: username, score: score};
          user_scores.push(user);
        }
      });
      user_scores = _.sortBy(user_scores, function(user, position, list) {
        return -user.score; // sortBy sorts by value returned in descending order
      });

      var top15 = top15Only || false;
      if(top15) {
        cb.call(null, user_scores.slice(0,15));
      }
      else {
        cb.call(null, user_scores);
      }


    };


  };


require("./database/singleton");
setTimeout(function() {
	

	var server = new Server();
	console.log('Calculating leaderboard');
	server.calculateLeaderboard(function() {
		console.log('The leaderboard has been calculated!');
		server.getLeaderboard(false, function(user_scores) {
			console.log("Here are the user scores!");
			console.log(user_scores);
		});
	});

	return server;

}, 5000);



}());
