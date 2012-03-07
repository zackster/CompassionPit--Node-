(function () {
    "use strict";
    var mongoose = require('mongoose'),
        Schema = mongoose.Schema,
        ObjectId = Schema.ObjectId,
        Users = mongoose.model('Users', new Schema({
                        email       : {
                          type:       String,
                          validate:   new RegExp('[a-z0-9!#$%&\'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&\'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?'),
                          index:      {
                                        unique:     true,
                                        dropDups:   true
                                      }
                        },
                        password    : {
                          type:       String,
                          validate:   [function(str) { return str.length>0; }]
                        }
                  })),
        hashlib = require('hashlib'),
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
        
          return this.logged_in_users[id];
        
        };      
        
        this.login = function (id, username, password, callback) {
          var self = this;
          console.log("ID: %s\nUSERNAME: %s\nPASSWORD: %s", id, username, password);
          client.query(
            'SELECT username, password, salt FROM user WHERE username=?', [username], function selectCb(err, results, fields) {
              if (err) {
                throw err;
              }
              if(!results.length) {
                callback(false);
                return;
              }
              if(password === hashlib.md5(hashlib.md5(password)+results[0].salt)) {
                self.logged_in_users[id] = username;
                callback(true);
                return;
              }
              else {
                callback(false);
                return;
              }
            });
          
        }
    }  
  

  
    exports.authServer = function() {
      return new Server();
    }
  
})();