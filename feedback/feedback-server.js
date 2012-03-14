(function () {

  var mongoose       = require('mongoose'),
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
                                  })),
    self = this;



  var server = {
    addFeedback : function (feedback) {
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
    },
    creditFeedback : function(user) {
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
    },
    calculateLeaderboard: function() {
        var server_object_context = this;
        Feedback.distinct('listener', { listener: { $exists:true} }, function(err, listeners) {
          if(err) { console.log("Error! " + err ); return; }
          var listenerScores = [];
          var left = listeners.length;
          for(var i in listeners) {

           (function(thisListener) {
             var score = 0;
             // if(!is_email_address.test(thisListener)) {
             //   left--;
             //   return;
             // }
             Feedback.count({listener:thisListener, direction:'positive'}, function(err, docs) {
               if(err) { console.log("error! " + err); return; }
               score += docs;
               Feedback.count({listener:thisListener, direction:'negative'}, function(err, docs) {
                  if(err) { console.log("error! " + err); return; }
                  score -= docs;
                  listenerScores[thisListener]=score;
                  if(--left === 0) {
                    setTimeout(function() {
                      server_object_context.calculateLeaderboard();
                    }, 5000);
                    self.mostRecentScores = listenerScores;
                  }
              });
            });
          })(listeners[i]);
        }
      });
    },
    getLeaderboard: function(cb) {
      console.log("self.mRS is ...");
      console.log(self.mostRecentScores);
      cb(self.mostRecentScores);
    }

  };
  
  
  
  exports.feedbackServer = function() {
    server.calculateLeaderboard();
    return server;
  };
  
  
  
  
})();