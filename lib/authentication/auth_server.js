(function() {
  "use strict";
  var Server, config, createHash, hashlib, mysql;

  hashlib = require("hashlib2");

  createHash = require("../utils").createHash;

  mysql = require("mysql");

  config = require("../config");

  Server = (function() {

    function Server() {
      this.logged_in_users = createHash();
    }

    Server.prototype.getMySQLClient = function() {
      var client;
      client = mysql.createClient({
        user: config.vBulletin.username,
        password: config.vBulletin.password
      });
      client.query("USE " + config.vBulletin.database);
      return client;
    };

    Server.prototype.userInfo = function(id, callback) {
      var client;
      client = this.getMySQLClient();
      return client.query("SELECT * FROM user WHERE userid = ? LIMIT 1", [id], function(err, results, fields) {
        if (err) throw err;
        callback(results[0]);
        return client.end();
      });
    };

    Server.prototype.getEmailAddressFromUsername = function(username, callback) {
      var client;
      client = this.getMySQLClient();
      return client.query("SELECT email FROM user WHERE username = ? LIMIT 1", [username], function(err, results, fields) {
        if (err) throw err;
        callback(results[0].email);
        return client.end();
      });
    };

    Server.prototype.markLoggedIn = function(user, callback) {
      var self;
      self = this;
      return this.userInfo(user, function(uinfo) {
        var client, epoch_in_seconds;
        client = self.getMySQLClient();
        epoch_in_seconds = Date.now() / 1000;
        return client.query("UPDATE user SET lastactivity = ? WHERE userid = ? LIMIT 1", [epoch_in_seconds, user], function(err, results, fields) {
          if (err) throw err;
          if ((epoch_in_seconds - uinfo.lastactivity) > 604800) {
            client.query("UPDATE user SET lastvisit = ? WHERE userid = ? LIMIT 1", [uinfo.lastactivity, user], function() {
              return client.end();
            });
          }
          callback.call(self, uinfo.username);
          return client.end();
        });
      });
    };

    Server.prototype.checkLogin = function(req, callback) {
      var self;
      self = this;
      return this.getCookie(req.cookies.bb_userid, req.cookies.bb_password, function(user) {
        if (user) {
          return self.markLoggedIn(req.cookies.bb_userid, function(username) {
            return callback.call(self, username);
          });
        } else {
          return self.getSession(req, req.cookies.bb_sessionhash, function(user) {
            if (user) {
              return self.markLoggedIn(user, function(username) {
                return callback.call(self, username);
              });
            } else {
              return callback.call(self, false);
            }
          });
        }
      });
    };

    Server.prototype.getCookie = function(id, pass, callback) {
      var client, self;
      self = this;
      client = this.getMySQLClient();
      return client.query("SELECT * FROM user WHERE userid = ? LIMIT 1", [id], function(err, results, fields) {
        var dbpass, row;
        if (err) throw err;
        if (results.length > 0) {
          row = results[0];
          dbpass = row.password;
          if (hashlib.md5(dbpass + "CpnsPhJPwVeQgmKX5Wdz8JOz4TV") === pass) {
            callback.call(self, id);
            client.end();
            return;
          }
        }
        callback.call(self, false);
        return client.end();
      });
    };

    Server.prototype.getSession = function(req, hash, callback) {
      var client, ip, ip_address, newidhash, self, user_agent;
      ip_address = void 0;
      if ("development" === (process.env.NODE_ENV || "development")) {
        ip_address = "127.0.0.1";
      } else {
        ip_address = req.headers["x-forwarded-for"] || req.address.address;
      }
      user_agent = req.headers["user-agent"];
      self = this;
      ip = ip_address.split(".").slice(0, 3).join(".");
      newidhash = hashlib.md5(user_agent + ip);
      client = this.getMySQLClient();
      return client.query("SELECT * FROM session WHERE sessionhash = ? LIMIT 1", [hash], function(err, results, fields) {
        var epoch_in_seconds, idhash, lastactive, row, userid;
        if (err) throw err;
        if (results.length > 0) {
          row = results[0];
          idhash = row.idhash;
          userid = row.userid;
          lastactive = row.lastactivity;
          epoch_in_seconds = Date.now() / 1000;
          callback.call(self, (idhash === newidhash && (epoch_in_seconds - lastactive) < 604800 ? userid : false));
          client.end();
          return;
        }
        callback.call(self, false);
        return client.end();
      });
    };

    Server.prototype.getUsernameFromListenerId = function(listener_id) {
      return this.logged_in_users[listener_id];
    };

    Server.prototype.login = function(id, username, password, callback) {
      var client, self;
      client = this.getMySQLClient();
      client.query("USE " + config.vBulletin.database);
      self = this;
      return client.query("SELECT username, password, salt FROM user WHERE username=?", [username], function(err, results, fields) {
        client.end();
        if (err) throw err;
        if (!results.length) callback(false);
        if (results[0].password === hashlib.md5(hashlib.md5(password) + results[0].salt)) {
          self.logged_in_users[id] = username;
          callback(true);
        } else {
          callback(false);
        }
        return client.end();
      });
    };

    return Server;

  })();

  module.exports.authServer = function() {
    return new Server();
  };

}).call(this);
