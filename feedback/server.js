(function() {
  

  var mongoose       = require('mongoose')
    , authServer     = require('../authentication/server').authServer();

  var Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId;

  // db.feedbacks.ensureIndex({venter: 1, listener: 1}, {unique: true});
    
  var Feedback = mongoose.model('Feedback', new Schema({
        listener:     {
                        type:       String,
                        validate:   [function(str) { return str.length>0; }]
                      }
      , venter:       {
                        type:       String,
                        validate:   [function(str) { return str.length>0; }]
                      }
      , direction:    {
                        type:       String,
                        validate:   [function(str) { if(str==='positive' || str==='negative') { return true; } else { return false; }}]
                      }
  }));

  


  var server = {
    addFeedback : function(feedback) {
      var instance = new Feedback();
      instance.venter = feedback.venter;
      
      listener_account = authServer.getEmailFromUserId(feedback.listener);
      instance.listener = listener_account ? listener_account : feedback.listener;
          
      
      instance.direction = feedback.direction;
      instance.save(function(err) {
        status = {};
        if(err.errors) {
          badFields = [];
          for (badField in err.errors) {
            badFields.push(badField);
          };          
          console.log("ERROR!");
          console.log(badFields);
        }
        else if(err) {          
          console.log("ERROR!");
          console.log('duplicate');
        }
        else {
          console.log('success');
        }
      });
    },
    creditFeedback : function(user) {
      var conditions = { listener: user.id }
        , update     = { listener: user.email  }
        , options    = { multi: true };
      Feedback.update(conditions, update, options, callback);
      var callback = function(err, numAffected) {
        console.log("error: ", err);
        console.log("numAffected: ", numAffected);        
      } 
    },
    calculateLeaderboard: function(callback) {

      var listenerScores = {};
  

      Feedback.distinct('listener', { listener: { $exists:true} }, function(err, listeners) {
        if(err) {
          console.log("Error! " + err );
          return;
        } 
        
        var   left = listeners.length
            , score
            , thisListener;
            
        for(var i in listeners) {            

          (function(thisListener, score) {

            Feedback.count({listener:thisListener, direction:'positive'}, function(err, docs) {
              if(err) { console.log("error! " + err); return; }
              score += docs;
              Feedback.count({listener:thisListener, direction:'negative'}, function(err, docs) {
                if(err) { console.log("error! " + err); return; }
                score -= docs;
                listenerScores[thisListener]=score;
                if(--left === 0) {
                    callback(listenerScores);
                }
              });
            });                     
          })(listeners[i], score=0);
        }
      });            
    }

  };
  
  exports.feedbackServer = function() {
    return server;
  }
  

  
})();