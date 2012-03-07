(function () {
    "use strict";
    var hashlib = require('hashlib'),
        mysql = require('mysql'),
        config = require("../config"),
        client = mysql.createClient({
          user: config.vBulletin.username,
          password: config.vBulletin.password
        });
        
        client.query('USE '+config.vBulletin.database);
  


    function Server() {
    
        this.logged_in_users = {};
    
        this.getEmailFromListenerId = function(id) {
          console.log("Looking up listener id: %s", id);
          console.log("Returning: %s", this.logged_in_users[id]);
          return this.logged_in_users[id];
        
        };      
        
        this.login = function (id, username, password) {
          var self = this;
          client.query(
            'SELECT username, password, salt FROM user WHERE username=?', [username], function selectCb(err, results, fields) {
              if (err) {
                throw err;
              }
              if(!results.length) {
                return false;
              }
              if(results[0].password === hashlib.md5(hashlib.md5(password)+results[0].salt)) {
                self.logged_in_users[id] = username;
                return true;
              }
              else {
                return false;
              }
            });
          
        }
    }  
  

  
    exports.authServer = function() {
      return new Server();
    }
  
})();