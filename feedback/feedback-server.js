(function () {

  "use strict";
  var mongoose       = require('mongoose'),
    _ = require('underscore'),
    regexp = require(".././utils").regexp,
    User = require(".././users/models").User,
    authServer     = require('../authentication/auth-server').authServer(),
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

    this.addFeedback = function (feedback) {
      console.log("Adding feedback");
      console.log(feedback);

      var instance = new Feedback();
      instance.venter = feedback.venter;

      var listener_account = authServer.getUsernameFromListenerId(feedback.listener);

      instance.listener = listener_account ? listener_account : feedback.listener;
      instance.direction = feedback.direction;

      var venter_ip = User.getById(feedback.venter).getIPAddress();
      var listener_ip = User.getById(feedback.listener).getIPAddress();
      instance.ipAddress = listener_ip;

      if(venter_ip === listener_ip) {
        console.log("We aren't adding feedback since both listener and venter share an IP address.");
        return;
      }


      instance.save(function(err) {
        if(err && err.errors) {
          var badFields = [];
          for (var badField in err.errors) {
            if(err.errors.hasOwnProperty(badField)) {
              badFields.push(badField);
            }
          }
          console.log("ERROR!");
          console.log(badFields);
        }
        else if(err) {
          console.log("ERROR! duplicate");
        }
        else {
          console.log('successfully added feedback');
        }
      });
    };

    this.creditFeedback = function(user) {
      console.log("About to credit feedback");
      console.log("user id:", user.id);
      console.log("user username:", user.username);

      var conditions = { listener: user.id };
      var update     = { listener: user.username };
      var options    = { multi: true };
      console.log("Calling the Feedback.update function....");
      Feedback.update(conditions, update, options, function(err, numAffected) {
        console.log("Credit feedback - callback invoked! w00t");
        console.log("error: ", err);
        console.log("numAffected: ", numAffected);
      });
    };


   this.calculateLeaderboard = function() {
      console.log("We are calculating the leaderboard.");
      var server_object_context = this;
      Feedback.distinct('listener', {
          listener: {
              $exists: true
          }
      },
      function(err, listeners) {
          if (err) {
              console.log("Error! " + err);
              return;
          }
          for (var i in listeners) {

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
                    self.listenerScores[thisListener] = (self.listenerScores[thisListener] || 0) + (5 * docs);
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
                    self.listenerScores[thisListener] = (self.listenerScores[thisListener] || 0) + (-3 * docs);
                });

              }(listeners[i]));
            }

          }

          setTimeout(function() {
              server_object_context.calculateLeaderboard();
          },
          5000*1000);
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
        for(var i=user_position-2; i>=0; i--) {
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

    this.ipAddressHasNeverReceivedNegativeFeedback = function(ip_address, callback) {
        Feedback.count({
            ipAddress: ip_address,
            direction: 'negative'
        },
        function(err, docs) {
            if (err) {
                console.log("error! " + err);
                return;
            }
            if(docs==0) {
                callback(true);
            }
            else {
                callback(false);
            }
        });
    };


  };



  exports.feedbackServer = function() {
    var server = new Server();
    // console.log("We are calling calculate leaderboard!");
    server.calculateLeaderboard();
    return server;
  };




})();