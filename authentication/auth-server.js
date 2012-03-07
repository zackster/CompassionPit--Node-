(function () {
    "use strict";
    var hashlib = require('hashlib'),
        createHash = require("../utils").createHash,
        mysql = require('mysql'),
        config = require("../config"),
        client = mysql.createClient({
          user: config.vBulletin.username,
          password: config.vBulletin.password
        });
        
    client.query('USE '+config.vBulletin.database);

    var logged_in_users = createHash();

    function Server() {
    }
    
    Server.prototype.getUsernameFromListenerId = function(listener_id) {
      console.log("Looking up listener id: %s", listener_id);
      console.log("Returning: %s", logged_in_users[listener_id]);
      return logged_in_users[listener_id];
    };
    
    Server.prototype.login = function (id, username, password, callback) {
      console.log("ID: %s\nUSERNAME: %s\nPASSWORD: %s", id, username, password);
      client.query(
        'SELECT username, password, salt FROM user WHERE username=?', [username], function selectCb(err, results, fields) {
          console.log("err: %s\nresults: %s\nfields: %s\n", err, results, fields);
          if (err) {
            throw err;
          }
          if(!results.length) {
            console.log("Returning false bc no users with that username.");
            callback(false);
          }
          if(results[0].password === hashlib.md5(hashlib.md5(password)+results[0].salt)) {
            console.log("Returning true!");
            console.log(logged_in_users);
            logged_in_users[id] = username;
            console.log(logged_in_users);
            callback(true);
          }
          else {
            console.log("Returning false: wrong pw.");
            callback(false);
          }
        });
      
    };
  

  
    exports.authServer = function() {
      return new Server();
    };
  
})();