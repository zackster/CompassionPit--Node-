(function() {
  "use strict";
  var config, getMySQLClient, mysql;

  mysql = require("mysql");

  config = require("../config");

  getMySQLClient = function() {
    var client;
    client = mysql.createClient({
      user: config.vBulletin.username,
      password: config.vBulletin.password
    });
    client.query("USE " + config.vBulletin.database);
    return client;
  };

  exports.getEmailAndJoindateForUser = function(username, callback) {
    var client, selectCb;
    client = getMySQLClient();
    return client.query("SELECT email, joindate as created_at FROM user WHERE username = ?", [username], selectCb = function(err, results, fields) {
      if (err) {
        throw err;
      } else {
        callback(results[0]);
        return client.end();
      }
    });
  };

}).call(this);
