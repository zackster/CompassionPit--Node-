(function () {
    "use strict";
        var mysql = require('mysql'),
        config = require("./config");

    exports.getMySQLClient = function() {
      var client = mysql.createConnection({
         user: config.vBulletin.username,
         password: config.vBulletin.password,
	 database: config.vBulletin.database,
	 host: '74.207.228.243', 
      });
	client.connect(function(err) {
//		console.log(err);
	});
      return client;
    };

    exports.getEmailAndJoindateForUser = function(username, callback) {

		var client = exports.getMySQLClient();
		client.query("SELECT email, joindate as created_at FROM user WHERE username = ?", [username], function selectCb(err, results, fields) {
			if(err) {
				throw err;
			}
			else {
				callback(results[0]);
				client.end();
			}
		});  
    };


}());
