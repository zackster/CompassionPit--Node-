(function() {
  

  var mongoose      = require('mongoose')
    , dnode         = require('dnode')
    , config        = require('./config');
    
  mongoose.connect(config.mongodb.uri);
  console.log("Connected to mongoose");

  var Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId;

  var is_email_address = new RegExp('[a-z0-9!#$%&\'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&\'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?');
    
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
  
  var mostRecentScores = {};
  var self = this;
  
  var saveScores = function(scores) {
    
    console.log('savescores called');
    
    console.log("scores");
    console.log(scores);
    self.mostRecentScores = scores;
    console.log("mostRecentScores");
    console.log(self.mostRecentScores);
    
    console.log('-----');
    
    mostRecentScores = scores;
    
    console.log("mostRecentScores");
    console.log(mostRecentScores);
    
    
    console.log('-----');
    
    this.mostRecentScores = scores;
    
    console.log("mostRecentScores");
    console.log(this.mostRecentScores);
    
    

  }
  
  var getMostRecentScores = function(cb) {
    console.log("most, self, this");
    console.log(mostRecentScores);
    console.log(self.mostRecentScores);
    console.log(this.mostRecentScores);
    cb(mostRecentScores);
  }
  
  var calculateLeaderboard = function(callback) {
    
      console.log('calcLB being called');

  
      Feedback.distinct('listener', { listener: { $exists:true} }, function(err, listeners) {
        if(err) { console.log("Error! " + err ); return; } 
        console.log('we returned from distinct listeners');
        var listenerScores = {};
        var   left = listeners.length;
            
        for(var i in listeners) {            

         (function(thisListener, score) {
           if(!is_email_address.test(thisListener)) {
             left--;
             return;
           } 
           
           Feedback.count({listener:thisListener, direction:'positive'}, function(err, docs) {
             console.log('we returned from pos feed');
           if(err) { console.log("error! " + err); return; }
             score += docs;
             
             
             Feedback.count({listener:thisListener, direction:'negative'}, function(err, docs) {
               console.log('we returned from ned feed');
                if(err) { console.log("error! " + err); return; }
                score -= docs;
                listenerScores[thisListener]=score;
                console.log("left is now at %d", left);
                if(--left === 0) {
                  console.log('calcLB is calling saveScores');
                  saveScores(listenerScores);
                  console.log('calcLB is setting a timeout');
                  setTimeout(function() { 
                    console.log('timeout function is being called');
                    calculateLeaderboard(saveScores);
                  }, 5000);
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