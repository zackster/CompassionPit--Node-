(function () {
    "use strict";
    var hashlib = require('hashlib2'),
        createHash = require("../utils").createHash,
        mysql = require('mysql'),
        config = require("../config");


    var logged_in_users = createHash();

    function Server() {
    }

    Server.prototype.getMySQLClient = function() {
      var client = mysql.createClient({
         user: config.vBulletin.username,
         password: config.vBulletin.password
      });
      client.query('USE '+config.vBulletin.database);
      return client;
    };

    Server.prototype.userInfo = function(id, callback) {
      var client = this.getMySQLClient();
      client.query("SELECT * FROM user WHERE userid = ? LIMIT 1", [id], function selectCb(err, results, fields) {
        if(err) {
          throw err;
        }
        callback.call(null, results[0]);
        client.end();
      });
    };

    Server.prototype.markLoggedIn = function(user) {
      var self = this;
      this.userInfo(user, function(uinfo) {
        console.log("Mark logged in being callled");
        console.log("Uinfo", uinfo);
        var client = self.getMySQLClient();
        var epoch_in_seconds = Date.now() / 1000; // vBulletin stores epoch in seconds, Date.now() returns a value in ms
        client.query("UPDATE user SET lastactivity = ? WHERE userid = ? LIMIT 1", [epoch_in_seconds, user], function updateCb(err, results, fields) {
          if(err) {
            throw err;
          }
          if((epoch_in_seconds - uinfo.lastactivity) > 900) {
            client.query("UPDATE user SET lastvisit = ? WHERE userid = ? LIMIT 1", [uinfo.lastactivity, user], function() {
                client.end();
            });
          }
          client.end();
        });

      });
    };

    Server.prototype.checkLogin = function(req, callback) {
      var self = this; // Server context

      this.getCookie(req.cookies.bb_userid, req.cookies.bb_password, function(user) {
        if(user) {
          self.markLoggedIn(req.cookies.bb_userid);
          callback.call(null, true);
        }
        else {
          self.getSession(req, req.cookies.bb_sessionhash, function(user) {
            console.log('call back of getSession');
            console.log(user);
            if(user) {
              self.markLoggedIn(user);
              callback.call(self, true);
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
      var client = this.getMySQLClient();

      client.query("SELECT * FROM user WHERE userid = ? LIMIT 1", [id], function selectCb(err, results, fields) {
        if(err) {
          throw err;
        }
       if(results.length > 0){
          var row = results[0];
          var dbpass = row.password;
          // vb might change the salt from time to time. can be found in the /includes/functions.php file
          if(hashlib.md5(dbpass + '0d582e0835ec6697262764ae6cb467fb') == pass){
            callback.call(this, id);
          }
        }
        callback.call(self, false);

        client.end();
      });



    };

    Server.prototype.getSession = function(req, hash, callback) {

      var user_agent = req.headers['user-agent'];
      var ip_address = req.headers['x-forwarded-for']; // because of nginx proxying
      var self = this;

      
      var ip = ip_address.split('.').slice(0, 3).join('.');
      var newidhash = hashlib.md5(user_agent + ip);
      console.log("user agent", user_agent);
      console.log("ip addr", ip_address);
      console.log("ip", ip);
      console.log("new id hash", newidhash);

      var client = this.getMySQLClient();
      client.query("SELECT * FROM session WHERE sessionhash = ? LIMIT 1", [hash], function selectCb(err, results, fields) {
        
        console.log("callback from getSession SQL ...");
        console.log("We searched on the hash,", hash);
        console.log("---cookies---");
        console.log(req.cookies);
        console.log(err, results);
        
        
        if(err) {
          throw err;
        }

       if(results.length > 0){
          var row = results[0];

          var idhash = row.idhash;
          var userid = row.userid;
          var lastactive = row.lastactivity;
          var epoch_in_seconds = Date.now() / 1000; // vBulletin stores epoch in seconds, Date.now() returns a value in ms
          callback.call(self, (idhash == newidhash && (epoch_in_seconds - lastactive) < 900) ? userid : false);
        }
        callback.call(self, false);

        client.end();

      });

    };


    Server.prototype.getUsernameFromListenerId = function(listener_id) {
      console.log("Looking up listener id: %s", listener_id);
      console.log("Returning: %s", logged_in_users[listener_id]);
      return logged_in_users[listener_id];
    };

    Server.prototype.login = function (id, username, password, callback) {
      var client = this.getMySQLClient();

      client.query('USE '+config.vBulletin.database);
      console.log("ID: %s\nUSERNAME: %s\nPASSWORD: %s", id, username, password);
      client.query(
        'SELECT username, password, salt FROM user WHERE username=?', [username], function selectCb(err, results, fields) {
          console.log('ending client');
          client.end();
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
          client.end();
        });

    };



    exports.authServer = function() {
      return new Server();
    };

})();