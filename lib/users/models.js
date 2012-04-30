(function() {
  "use strict";
  var User, config, configGeoParts, createHash, forceLatency, guid, log, socketIOIdToUserId, userIdToSocketIOId, userIdToUser, userIdsWithoutSocketIOClient, userPublicIdToUserId;

  log = require("../log");

  createHash = require("../utils").createHash;

  guid = require("../utils").guid;

  config = require("../config");

  forceLatency = require("../utils").forceLatency;

  userIdToUser = {};

  userPublicIdToUserId = {};

  userIdToSocketIOId = {};

  socketIOIdToUserId = {};

  userIdsWithoutSocketIOClient = {};

  User = function(socketIOId, id, publicId) {
    this.id = id = id || guid();
    this.publicId = publicId = publicId || guid();
    this.join_time = new Date().getTime();
    this.partner_list = [];
    this.socket = require("../app").socket;
    this.messageBacklog = [];
    this.messageQueue = [];
    this.socketIOId = socketIOId;
    userIdToSocketIOId[id] = socketIOId;
    socketIOIdToUserId[socketIOId] = id;
    userIdToUser[id] = this;
    userPublicIdToUserId[publicId] = id;
    this.disconnectCallbacks = [];
    this.lastSentMessageIndex = 0;
    this.lastReceivedMessageIndex = 0;
    return this.userAgent = "";
  };

  User.prototype.setSocketIOId = function(newId, lastMessageClientReceived) {
    var oldId;
    oldId = this.socketIOId;
    if (oldId === newId) return;
    delete socketIOIdToUserId[oldId];
    if (newId) {
      userIdToSocketIOId[this.id] = this.socketIOId = newId;
      socketIOIdToUserId[newId] = this.id;
      delete userIdsWithoutSocketIOClient[this.id];
      delete this.disconnectTime;
      return this.flushMessageQueue(lastMessageClientReceived);
    } else {
      this.socketIOId = null;
      delete userIdToSocketIOId[this.id];
      userIdsWithoutSocketIOClient[this.id] = true;
      return this.disconnectTime = Date.now() + config.disconnectLeeway;
    }
  };

  User.prototype.isClientConnected = function() {
    var clientId;
    clientId = this.socketIOId;
    if (!clientId) return false;
    return !!this.socket.connected[clientId];
  };

  User.prototype.disconnect = function(callback) {
    return this.disconnectCallbacks.push(callback);
  };

  User.prototype.destroy = function() {
    var i, id, len, socketIOId;
    i = 0;
    len = this.disconnectCallbacks.length;
    while (i < len) {
      this.disconnectCallbacks[i].call(this);
      i += 1;
    }
    id = this.id;
    delete userIdsWithoutSocketIOClient[id];
    if (userPublicIdToUserId[this.publicId] === id) {
      delete userPublicIdToUserId[this.publicId];
    }
    socketIOId = userIdToSocketIOId[id];
    if (socketIOId) {
      delete userIdToSocketIOId[id];
      if (socketIOIdToUserId[socketIOId] === id) {
        delete socketIOIdToUserId[socketIOId];
      }
    }
    return delete userIdToUser[id];
  };

  User.prototype.getIPAddress = function() {
    var client, socketIOId;
    if (this.ipAddress) return this.ipAddress;
    socketIOId = userIdToSocketIOId[this.id];
    if (!socketIOId) return null;
    if (!this.socket.connected[socketIOId]) return null;
    client = this.socket.of("").socket(socketIOId);
    if (!client) return null;
    return this.ipAddress = client.handshake.address.address;
  };

  User.prototype.setIPAddress = function(ipAddress) {
    return this.ipAddress = ipAddress;
  };

  configGeoParts = config.geoLocationParts || [];

  User.prototype.lookupGeoIP = function(callback) {
    var ipAddress;
    ipAddress = this.getIPAddress();
    if (!ipAddress || ipAddress === "127.0.0.1") {
      return callback(null);
    } else {
      return require("../app").geoipCity.lookup(ipAddress, function(err, data) {
        var geoIp, i, len, part, parts;
        if (err) {
          log.error({
            event: "GeoIP",
            error: String(err.message),
            stack: String(err.stack),
            ipAddress: ipAddress
          });
          callback(null);
          return;
        }
        parts = [];
        i = 0;
        len = configGeoParts.length;
        while (i < len) {
          part = data[configGeoParts[i]];
          if (part && isNaN(Number(part, 10))) parts.push(part);
          i += 1;
        }
        geoIp = parts.join(", ") || null;
        if (geoIp === null || !data.country_name) {
          return callback(null);
        } else {
          return callback(geoIp);
        }
      });
    }
  };

  User.prototype.flushMessageQueue = function(lastMessageClientReceived) {
    var backlog, client, clientId, queue;
    clientId = this.socketIOId;
    if (!clientId) return;
    if (!this.socket.connected[clientId]) return;
    client = this.socket.of("").socket(clientId);
    backlog = this.messageBacklog;
    queue = this.messageQueue;
    return forceLatency(function() {
      var i, len, message, wholeMessage, _results;
      i = void 0;
      len = void 0;
      message = void 0;
      wholeMessage = [];
      if (lastMessageClientReceived) {
        i = 0;
        len = backlog.length;
        while (i < len) {
          message = backlog[i];
          if (message.n > lastMessageClientReceived) wholeMessage.push(message);
          i += 1;
        }
      }
      len = queue.length;
      i = 0;
      while (i < len) {
        message = queue[i];
        wholeMessage.push(message);
        backlog.push(message);
        i += 1;
      }
      queue.length = 0;
      if (backlog.length > config.messageBacklogPerUser) {
        backlog.splice(0, backlog.length - config.messageBacklogPerUser);
      }
      i = 0;
      len = wholeMessage.length;
      _results = [];
      while (i < len) {
        client.json.send(wholeMessage[i]);
        _results.push(i += 1);
      }
      return _results;
    });
  };

  User.prototype.send = function(message) {
    message.n = this.lastSentMessageIndex = this.lastSentMessageIndex + 1;
    this.messageQueue.push(message);
    return this.flushMessageQueue();
  };

  User.getById = function(id) {
    var user;
    user = userIdToUser[id];
    if (user) return user;
  };

  User.getByPublicId = function(publicId) {
    var id;
    id = userPublicIdToUserId[publicId];
    if (id) return User.getById(id);
  };

  User.getBySocketIOId = function(socketIOId) {
    var userId;
    userId = socketIOIdToUserId[socketIOId];
    if (userId) return User.getById(userId);
  };

  User.cleanup = function() {
    var count, i, id, ids, maxDisconnectTime, user, _results;
    maxDisconnectTime = Date.now();
    ids = Object.keys(userIdsWithoutSocketIOClient);
    count = ids.length;
    i = 0;
    _results = [];
    while (i < count) {
      id = ids[i];
      user = userIdToUser[id];
      if (user.disconnectTime < maxDisconnectTime) user.destroy();
      _results.push(i += 1);
    }
    return _results;
  };

  module.exports.User = User;

}).call(this);
