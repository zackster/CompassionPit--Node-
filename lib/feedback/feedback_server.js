(function() {
  "use strict";
  var Feedback, Schema, Server, User, authServer, mongoose, regexp, _;

  mongoose = require("mongoose");

  _ = require("underscore");

  regexp = require("../lib/utils").regexp;

  User = require("../users/models").User;

  authServer = require("../authentication/auth_server").authServer();

  Schema = mongoose.Schema;

  Feedback = mongoose.model("Feedback", new Schema({
    listener: {
      type: String,
      validate: [
        function(str) {
          return str.length > 0;
        }
      ]
    }
  }));

  ({
    venter: {
      type: String,
      validate: [
        function(str) {
          return str.length > 0;
        }
      ]
    },
    direction: {
      type: String,
      validate: [
        function(str) {
          return str === "positive" || str === "negative";
        }
      ]
    },
    ipAddress: {
      type: String
    }
  });

  Server = (function() {

    function Server() {}

    Server.prototype.listenerScores = {};

    Server.prototype.addFeedback = function(feedback) {
      var instance, listener_account, listener_ip, venter_ip;
      console.log("Adding feedback");
      console.log(feedback);
      instance = new Feedback();
      instance.venter = feedback.venter;
      listener_account = authServer.getUsernameFromListenerId(feedback.listener);
      instance.listener = (listener_account ? listener_account : feedback.listener);
      instance.direction = feedback.direction;
      venter_ip = User.getById(feedback.venter).getIPAddress();
      listener_ip = User.getById(feedback.listener).getIPAddress();
      instance.ipAddress = listener_ip;
      if (venter_ip === listener_ip) {
        console.log("We aren't adding feedback since both listener and venter share an IP address.");
        return;
      }
      return instance.save(function(err) {
        var badField, badFields;
        if (err && err.errors) {
          badFields = [];
          for (badField in err.errors) {
            if (err.errors.hasOwnProperty(badField)) badFields.push(badField);
          }
          console.log("ERROR!");
          return console.log(badFields);
        } else if (err) {
          return console.log("ERROR! duplicate");
        } else {
          return console.log("successfully added feedback");
        }
      });
    };

    Server.prototype.creditFeedback = function(user) {
      var conditions, options, update;
      console.log("About to credit feedback");
      console.log("user id:", user.id);
      console.log("user username:", user.username);
      conditions = {
        listener: user.id
      };
      update = {
        listener: user.username
      };
      options = {
        multi: true
      };
      console.log("Calling the Feedback.update function....");
      return Feedback.update(conditions, update, options, function(err, numAffected) {
        console.log("Credit feedback - callback invoked! w00t");
        console.log("error: ", err);
        return console.log("numAffected: ", numAffected);
      });
    };

    Server.prototype.calculateLeaderboard = function() {
      var self, server_object_context;
      console.log("We are calculating the leaderboard.");
      server_object_context = this;
      self = this;
      return Feedback.distinct("listener", {
        listener: {
          $exists: true
        }
      }, function(err, listeners) {
        var i;
        if (err) {
          console.log("Error! " + err);
          return;
        }
        for (i in listeners) {
          if (listeners.hasOwnProperty(i)) {
            (function(thisListener) {
              Feedback.count({
                listener: thisListener,
                direction: "positive"
              }, function(err, docs) {
                if (err) {
                  console.log("error! " + err);
                  return;
                }
                return self.listenerScores[thisListener] = (self.listenerScores[thisListener] || 0) + (5 * docs);
              });
              return Feedback.count({
                listener: thisListener,
                direction: "negative"
              }, function(err, docs) {
                if (err) {
                  console.log("error! " + err);
                  return;
                }
                return self.listenerScores[thisListener] = (self.listenerScores[thisListener] || 0) + (-3 * docs);
              });
            })(listeners[i]);
          }
        }
        return setTimeout((function() {
          return server_object_context.calculateLeaderboard();
        }), 5000 * 1000);
      });
    };

    Server.prototype.getLeaderboardForUser = function(loggedInUser, cb) {
      var diff_needed_to_move_up, i, logged_in_user_score, scores, user_position, user_scores, user_scores_sorted;
      scores = this.listenerScores;
      user_scores = [];
      _.each(scores, function(score, username, list) {
        var valid_user;
        if (username.length !== 24 && !regexp().email.test(username)) {
          valid_user = {
            username: username,
            score: score
          };
          return user_scores.push(valid_user);
        }
      });
      user_scores_sorted = _.sortBy(user_scores, function(user_to_sort, position, list) {
        return -user_to_sort.score;
      });
      user_position = -1;
      _.each(user_scores_sorted, function(user, position, list) {
        if (user.username === loggedInUser) return user_position = position + 1;
      });
      diff_needed_to_move_up = "N/A :)";
      if (user_position !== -1) {
        logged_in_user_score = user_scores_sorted[user_position - 1].score;
        i = user_position - 2;
        while (i >= 0) {
          if (user_scores_sorted[i].score > logged_in_user_score) {
            diff_needed_to_move_up = user_scores_sorted[i].score - logged_in_user_score;
            break;
          }
          i--;
        }
        cb.call(null, {
          rank: user_position,
          score: logged_in_user_score,
          diff: diff_needed_to_move_up
        });
      } else {
        return cb.call(null, {
          rank: "Not On Leaderboard",
          score: "No Score",
          diff: "N/A"
        });
      }
    };

    Server.prototype.getLeaderboard = function(top15Only, cb) {
      var scores, top15, user_scores;
      scores = this.listenerScores;
      user_scores = [];
      _.each(scores, function(score, username, list) {
        var user;
        if (username.length !== 24 && !regexp().email.test(username)) {
          user = {
            username: username,
            score: score
          };
          return user_scores.push(user);
        }
      });
      user_scores = _.sortBy(user_scores, function(user, position, list) {
        return -user.score;
      });
      top15 = top15Only || false;
      if (top15) {
        return cb.call(null, user_scores.slice(0, 15));
      } else {
        return cb.call(null, user_scores);
      }
    };

    Server.prototype.ipAddressHasNeverReceivedNegativeFeedback = function(ip_address, callback) {
      return Feedback.count({
        ipAddress: ip_address,
        direction: "negative"
      }, function(err, docs) {
        if (err) {
          console.log("error! " + err);
          return;
        }
        if (docs === 0) {
          return callback(true);
        } else {
          return callback(false);
        }
      });
    };

    return Server;

  })();

  exports.feedbackServer = function() {
    var server;
    server = new Server();
    server.calculateLeaderboard();
    return server;
  };

}).call(this);
