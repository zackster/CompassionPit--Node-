(function () {
    "use strict";
        var mysql = require('mysql'),
        config = require("./config");

    var getMySQLClient = function() {
      var client = mysql.createClient({
         user: config.vBulletin.username,
         password: config.vBulletin.password
      });
      client.query('USE '+config.vBulletin.database);
      return client;
    };

    exports.getEmailAndJoindateForUser = function(username, callback) {

		var client = getMySQLClient();
		client.query("SELECT email, joindate as created_at FROM user WHERE username = ?", [username], function selectCb(err, results, fields) {
			if(err) {
				throw err;
			}
			else {
				callback(results[0]);
			}
		});  
    };

}());
