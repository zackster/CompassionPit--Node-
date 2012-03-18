(function() {
  
  var config = require('.././config');
  var mongoose = require("mongoose");
  
  mongoose.connect(config.mongodb.uri, function(err) {
    if(err) {
      throw err;
    }
    
    console.log('Successfully Connected To Mongoose!');
    console.log('(' + config.mongodb.uri + ')');
    
        
  });
  
  
  
  
})();