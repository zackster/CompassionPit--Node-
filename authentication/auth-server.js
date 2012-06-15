(function () {
    "use strict";
    var hashlib = require('hashlib2'),
    createHash = require("../utils").createHash,
	vB_dao = require('../vBDao');
	
	
    function Server() {
      this.logged_in_users = createHash();
    }

    Server.prototype.userInfo = function(id, callback) {
      var client = vB_dao.getMySQLClient();
      client.query("SELECT * FROM user WHERE userid = ? LIMIT 1", [id], function (err, results, fields) {
        if(err) {
          throw err;
        }
        callback(results[0]);
        client.end();
      });
    };

    Server.prototype.getEmailAddressFromUsername = function(username, callback) {
      var client = vB_dao.getMySQLClient();
      client.query("SELECT email FROM user WHERE username = ? LIMIT 1", [username], function (err, results, fields) {
        if(err) {
          throw err;
        }
        callback(results[0].email);
        client.end();
      });
    };

    Server.prototype.markLoggedIn = function(user, callback) {
      var self = this;

      this.userInfo(user, function(uinfo) {
        var client = vB_dao.getMySQLClient();
        var epoch_in_seconds = Date.now() / 1000; // vBulletin stores epoch in seconds, Date.now() returns a value in ms
        client.query("UPDATE user SET lastactivity = ? WHERE userid = ? LIMIT 1", [epoch_in_seconds, user], function (err, results, fields) {
          if(err) {
            throw err;
          }
          if((epoch_in_seconds - uinfo.lastactivity) > 604800) {
            client.query("UPDATE user SET lastvisit = ? WHERE userid = ? LIMIT 1", [uinfo.lastactivity, user], function() {
                client.end();
            });
          }
          callback.call(self, uinfo.username);
          client.end();
        });

      });
    };


    Server.prototype.checkLoginWithCookies = function(cookies, ip_address, user_agent, callback) {
      var self = this; // Server context
      this.getCookie(cookies.bb_userid, cookies.bb_password, function(user) {
        if(user) {
          self.markLoggedIn(cookies.bb_userid, function(username) {
            callback.call(self, username);
          });
        }
        else {
          self.getSession(ip_address, user_agent, cookies.bb_sessionhash, function(user) {
            if(user) {
              self.markLoggedIn(user, function(username) {
                callback.call(self, username);
              });
            }
            else {
              callback.call(self, false);
            }
          });
        }
      });
    };


    Server.prototype.checkLogin = function(req, callback) {
      var self = this; // Server context
      this.getCookie(req.cookies.bb_userid, req.cookies.bb_password, function(user) {
        if(user) {
          self.markLoggedIn(req.cookies.bb_userid, function(username) {
            callback.call(self, username);
          });
        }
        else {
          self.getSession(req, req.cookies.bb_sessionhash, function(user) {
            if(user) {
              self.markLoggedIn(user, function(username) {
                callback.call(self, username);
              });
            }
            else {
              callback.call(self, false);
            }
          });
        }
      });
    };

    Server.prototype.getCookie = function(id, pass, callback) {

      var self = this;
      var client = vB_dao.getMySQLClient();

      client.query("SELECT * FROM user WHERE userid = ? LIMIT 1", [id], function (err, results, fields) {
        if(err) {
          throw err;
        }
       if(results.length > 0){
          var row = results[0];
          var dbpass = row.password;
          // vb might change the salt from time to time. can be found in the /includes/functions.php file
          if(hashlib.md5(dbpass + 'CpnsPhJPwVeQgmKX5Wdz8JOz4TV') === pass){
            callback.call(self, id);
            client.end();
            return;
          }
        }
        callback.call(self, false);

        client.end();
      });

    };


    Server.prototype.getSessionWithIP = function(ip_address, user_agent, hash, callback) {

      var self = this;
      var ip = ip_address.split('.').slice(0, 3).join('.');
      var newidhash = hashlib.md5(user_agent + ip);
      var client = vB_dao.getMySQLClient();
      client.query("SELECT * FROM session WHERE sessionhash = ? LIMIT 1", [hash], function (err, results, fields) {
        if(err) {
          throw err;
        }
       if(results.length > 0){
          var row = results[0];

          var idhash = row.idhash;
          var userid = row.userid;
          var lastactive = row.lastactivity;
          var epoch_in_seconds = Date.now() / 1000; // vBulletin stores epoch in seconds, Date.now() returns a value in ms
          callback.call(self, (idhash === newidhash && (epoch_in_seconds - lastactive) < 604800) ? userid : false);
          client.end();
          return;
        }
        callback.call(self, false);
        client.end();
      });
    };


    Server.prototype.getSession = function(req, hash, callback) {

      var ip_address;

      if ("development" === (process.env.NODE_ENV || "development")) {
        ip_address = '127.0.0.1';
      }
      else {
        ip_address = req.headers['x-forwarded-for'] || req.address.address;
      }
      var user_agent = req.headers['user-agent'];
      var self = this;
      var ip = ip_address.split('.').slice(0, 3).join('.');
      var newidhash = hashlib.md5(user_agent + ip);
      var client = vB_dao.getMySQLClient();
      client.query("SELECT * FROM session WHERE sessionhash = ? LIMIT 1", [hash], function (err, results, fields) {
        if(err) {
          throw err;
        }
       if(results.length > 0){
          var row = results[0];

          var idhash = row.idhash;
          var userid = row.userid;
          var lastactive = row.lastactivity;
          var epoch_in_seconds = Date.now() / 1000; // vBulletin stores epoch in seconds, Date.now() returns a value in ms
          callback.call(self, (idhash === newidhash && (epoch_in_seconds - lastactive) < 604800) ? userid : false);
          client.end();
          return;
        }
        callback.call(self, false);
        client.end();
      });
    };


    Server.prototype.getUsernameFromListenerId = function(listener_id) {
      return this.logged_in_users[listener_id];
    };

    Server.prototype.login = function (id, username, password, callback) {
      var client = vB_dao.getMySQLClient();
      var self = this;
      client.query(
        'SELECT username, password, salt FROM user WHERE username=?', [username], function (err, results, fields) {
          client.end();
          if (err) {
            throw err;
          }
          if(!results.length) {
            callback(false);
          }
          if(results[0].password === hashlib.md5(hashlib.md5(password)+results[0].salt)) {
            self.logged_in_users[id] = username;
            callback(true);
          }
          else {
            callback(false);
          }
          client.end();
        });

    };



    exports.authServer = function() {
      return new Server();
    };

}());
