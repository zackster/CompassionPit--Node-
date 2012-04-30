(function() {
  "use strict";
  var Regexp, S4, email_regex, guid, hashSalt, hashlib;

  hashlib = require("hashlib2");

  S4 = function() {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };

  guid = function() {
    return S4() + S4() + S4() + S4() + S4() + S4();
  };

  email_regex = new RegExp("[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?");

  Regexp = function() {
    return {
      email: email_regex
    };
  };

  exports.regexp = function() {
    return new Regexp();
  };

  module.exports.S4 = S4;

  module.exports.guid = guid;

  module.exports.createHash = function(data, freeze) {
    var hash, key;
    hash = {};
    if (data == null) return hash;
    for (key in data) {
      if (data.hasOwnProperty(key)) hash[key] = data[key];
    }
    if (freeze) Object.freeze(hash);
    return hash;
  };

  exports.forceLatency = (function() {
    var LATENCY_TIME;
    LATENCY_TIME = require("./config").forceLatency;
    if (LATENCY_TIME <= 0) {
      return function(callback) {
        return callback();
      };
    } else {
      return function(callback) {
        return setTimeout(callback, LATENCY_TIME);
      };
    }
  })();

  exports.latencyWrap = (function() {
    var LATENCY_TIME;
    LATENCY_TIME = require("./config").forceLatency;
    if (LATENCY_TIME <= 0) {
      return function(callback) {
        return callback;
      };
    } else {
      return function(callback) {
        return function() {
          var args;
          args = Array.prototype.slice.call(arguments, 0);
          return setTimeout((function() {
            return callback.apply(undefined, args);
          }), LATENCY_TIME);
        };
      };
    }
  })();

  hashSalt = require("./config").hashIPAddressSalt || "";

  exports.hashIPAddress = function(address) {
    if (!address || address === "127.0.0.1") return "";
    return hashlib.sha512("CompassionPit$" + hashSalt + "$" + address);
  };

  exports.sendEmailToUser = function(email_address, template_name, username, score, rank, diff) {};

}).call(this);
