(function() {
  

  var mongoose      = require('mongoose')
    , dnode         = require('dnode')
    , config        = require('./config');
    
  mongoose.connect(config.mongodb.uri);
  console.log("Connected to mongoose");

  var Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId;

    
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
  
  var saveScores = function(scores) {

    console.log(scores); //debugging only
    this.mostRecentScores = scores;

  }
  
  var getMostRecentScores = function(cb) {
    console.log('called..');
    console.log('!',mostRecentScores);
    cb(mostRecentScores);
  }
  
  var calculateLeaderboard = function(callback) {

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
                    setTimeout(function() { 
                      calculateLeaderboard(saveScores);
                    }, 5000);
                    callback(listenerScores);
                }
            });
          });                     
        })(listeners[i], score=0);
      }
    });            
  }
  
  calculateLeaderboard(saveScores);
  
  var server = dnode({
    getMostRecentScores: getMostRecentScores
  }).listen(5050);
      
})();