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
        
        this.login = function (username, password, callback) {
          client.query(
            'SELECT username, password, salt FROM user WHERE username=?', [username], function selectCb(err, results, fields) {
              if (err) {
                throw err;
              }
              if(!results.length) {
                callback(false);
                return;
              }
              if(password == hashlib.md5(hashlib.md5(password)+results[0].salt)) {
                callback(true);
                return;
              }
              else {
                callback(false);
                return;
              }
            });
          
        }
              
        this.login = function (id, email, password, callback) { 
          if(typeof(callback)!=='function') return;
          var self = this;
          Users.find({'email': email, 'password': password}, function(err, docs) {
            if(err) {
              console.log('An error occurred: ' + err);
            }
            else {          
              if(docs.length) {
                self.logged_in_users[id] = email;
                callback('success');              
                return true;
              }
              else {
                callback('failure');
                return false;
              }
            }
          });
      
        };
      
        this.register = function(id, email, password, callback) {
          var self=this;
          var instance = new Users();
          instance.email = email;
          instance.password = password;
          instance.save(function(err) {
            status = {};
            if(err && err.errors) {
              badFields = [];
              for (badField in err.errors) {
                badFields.push(badField);
              };          
              console.log("registration bad fields" + badFields);
              callback({success: false, error: badFields});
            }
            else if(err) {          
              callback('duplicate');
              console.log('registration duplicates' + err);
              callback({success: false, error: 'duplicate'});
            }
            else {
              self.logged_in_users[id] = email;
              console.log('registration success');
              callback({success: true});
            }
          });
        };
    }  
  

  
    exports.authServer = function() {
      return new Server();
    }
  
})();