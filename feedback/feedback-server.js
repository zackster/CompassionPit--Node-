(function () {

  var mongoose       = require('mongoose'),
    _ = require('underscore'),
    regexp = require(".././utils").regexp,
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
                                          }
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
      
      
      instance.save(function(err) {
        if(err && err.errors) {
          var badFields = [];
          for (var badField in err.errors) {
            badFields.push(badField);
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
              
              (function() {
                
              
                var thisListener = listeners[i];
              

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
                    self.listenerScores[thisListener] = (self.listenerScores[thisListener] || 0) + (-6 * docs);
                });
              
              }());
                                
          }
          
          setTimeout(function() {
              server_object_context.calculateLeaderboard();
          },
          5000*1000);
      });
  };
    
    this.getLeaderboard = function(cb) {
      var scores = self.listenerScores;
      var user_scores = [];
      _.each(scores, function(score, username, list) {

        if(username.length != 24 && !regexp().email.test(username)) {
          var user = {username: username, score: score};
          user_scores.push(user);
        }
      });
      user_scores = _.sortBy(user_scores, function(user, position, list) {
        return -user.score; // sortBy sorts by value returned in descending order
      });
      
      
      
      cb.call(null, user_scores.slice(0,15));
    };

  };
  
  
  
  exports.feedbackServer = function() {
    var server = new Server();
    console.log("We are calling calculate leaderboard!");
    server.calculateLeaderboard();
    return server;
  };
  
  
  
  
})();