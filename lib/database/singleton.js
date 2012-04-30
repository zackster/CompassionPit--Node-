(function() {
  var config, mongoose;

  config = require(".././config");

  mongoose = require("mongoose");

  mongoose.connect(config.mongodb.uri, function(err) {
    if (err) throw err;
    console.log("Successfully Connected To Mongoose!");
    return console.log("(" + config.mongodb.uri + ")");
  });

}).call(this);
