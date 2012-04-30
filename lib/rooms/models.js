(function() {
  "use strict";
  var Conversation, DEVELOPMENT, EXPIRY_TIME, REQUESTED_PARTNER_TIMEOUT, Room, User, VALID_TYPES, async, createHash, feedbackServer, guid, hashIPAddress, listenerQueue, log, mongoose, queueRequestedPartners, rooms, saveConversation, underscore, userIdToRoomId, userInteractions, venterQueue;

  log = require("../log");

  underscore = require("underscore");

  guid = require("../lib/utils").guid;

  createHash = require("../lib/utils").createHash;

  User = require("../users/models").User;

  hashIPAddress = require("../lib/utils").hashIPAddress;

  feedbackServer = require("../feedback/feedback_server").feedbackServer();

  async = require("async");

  EXPIRY_TIME = 60 * 1000;

  REQUESTED_PARTNER_TIMEOUT = 10 * 1000;

  mongoose = require("mongoose");

  (function() {
    var ConversationPartner, Message, Schema;
    Schema = mongoose.Schema;
    ConversationPartner = {
      userId: {
        type: String
      },
      hashedIPAddress: {
        type: String
      },
      geoLocation: {},
      userAgent: {
        type: String
      }
    };
    Message = new Schema({
      partner: {
        type: String,
        "enum": ["venter", "listener", "system"]
      },
      text: {
        type: String
      },
      time: {
        type: Date,
        "default": Date.now
      }
    });
    return mongoose.model("Conversation", new Schema({
      serverSession: {
        type: String
      },
      status: {
        type: String,
        "enum": ["active", "complete"]
      },
      startTime: {
        type: Date,
        "default": Date.now
      },
      finishTime: {
        type: Date,
        "default": "01/01/0001"
      },
      finishReason: {
        type: String,
        "enum": ["venterDisconnect", "listenerDisconnect", "venterRequest", "listenerRequest", "venterReportedAbuse", "listenerReportedAbuse", "serverRestart", "unknown"],
        "default": "unknown"
      },
      venter: ConversationPartner,
      listener: ConversationPartner,
      messages: [Message]
    }));
  })();

  Conversation = exports.Conversation = mongoose.model("Conversation");

  saveConversation = function(conversation) {
    if (conversation.messages.length) {
      return conversation.save(function(err) {
        if (err) {
          return log.error({
            event: "Cannot save Conversation",
            error: err.toString()
          });
        }
      });
    }
  };

  setTimeout((function() {
    var serverSession;
    serverSession = require("../app").sessionId;
    return Conversation.find({
      serverSession: {
        $ne: serverSession
      },
      status: "active"
    }, function(err, conversations) {
      var conversation, i, len, _results;
      if (err) {
        return log.error({
          event: "Cannot retrieve inactive conversations",
          error: err.toString()
        });
      } else {
        i = 0;
        len = conversations.length;
        _results = [];
        while (i < len) {
          conversation = conversations[i];
          conversation.status = "complete";
          conversation.finishTime = Date.now();
          conversation.finishReason = "serverRestart";
          saveConversation(conversation);
          _results.push(i += 1);
        }
        return _results;
      }
    });
  }), 5000);

  rooms = createHash();

  VALID_TYPES = createHash({
    venter: true,
    listener: true
  }, true);

  listenerQueue = [];

  venterQueue = [];

  queueRequestedPartners = createHash();

  userIdToRoomId = createHash();

  userInteractions = createHash();

  DEVELOPMENT = (process.env.NODE_ENV || "development") === "development";

  Room = exports.Room = function(id, venterId, listenerId) {
    var conversation, listener, listenerIP, venter, venterIP;
    if (!(this instanceof Room)) return new Room(id, venterId, listenerId);
    id = String(id);
    this.id = id;
    this.startTime = this.lastAccessTime = Date.now();
    this.users = createHash();
    this.types = createHash({
      venter: 0,
      listener: 0
    });
    this.numMessages = 0;
    rooms[id] = this;
    log.info({
      event: "New room",
      room: id
    });
    this.addUser(venterId, "venter");
    this.addUser(listenerId, "listener");
    log.store("joinRoom", venterId);
    log.store("joinRoom", listenerId);
    venter = User.getById(venterId);
    venter.partner_list.push(listenerId);
    listener = User.getById(listenerId);
    listener.partner_list.push(venterId);
    venterIP = (venter ? venter.getIPAddress() || "" : "");
    listenerIP = (listener ? listener.getIPAddress() || "" : "");
    conversation = this.conversation = new Conversation({
      serverSession: require("../app").sessionId,
      status: "active",
      venter: {
        userId: venterId,
        hashedIPAddress: hashIPAddress(venterIP),
        geoLocation: {},
        userAgent: (venter ? venter.userAgent || "" : "")
      },
      listener: {
        userId: listenerId,
        hashedIPAddress: hashIPAddress(listenerIP),
        geoLocation: {},
        userAgent: (listener ? listener.userAgent || "" : "")
      },
      messages: []
    });
    saveConversation(conversation);
    if (venterIP && venterIP !== "127.0.0.1") {
      require("../app").geoipCity.lookup(venterIP, function(err, data) {
        if (err) {
          log.error({
            event: "GeoIP",
            error: String(err.message),
            stack: String(err.stack),
            ipAddress: venterIP
          });
          return;
        }
        conversation.venter.geoLocation = data;
        return saveConversation(conversation);
      });
    }
    if (listenerIP && listenerIP !== "127.0.0.1") {
      return require("../app").geoipCity.lookup(listenerIP, function(err, data) {
        if (err) {
          log.error({
            event: "GeoIP",
            error: String(err.message),
            stack: String(err.stack),
            ipAddress: listenerIP
          });
          return;
        }
        conversation.listener.geoLocation = data;
        return saveConversation(conversation);
      });
    }
  };

  Room.forEach = function(callback) {
    var key;
    for (key in rooms) {
      if (callback(rooms[key], key) === false) return;
    }
  };

  Room.calculateCounts = function() {
    var listenerId, listeners_here, numListeners, numVenters, venterId, venters_here;
    numListeners = listenerQueue.length;
    numVenters = venterQueue.length;
    venterId = void 0;
    listenerId = void 0;
    listeners_here = void 0;
    venters_here = void 0;
    Room.forEach(function(room, id) {
      venters_here = room.getNumUsersOfType("venter");
      listeners_here = room.getNumUsersOfType("listener");
      numListeners += listeners_here;
      numVenters += venters_here;
      if (listeners_here >= 1 && venters_here >= 1 && (Date.now() - room.startTime) > 1000 * 60 * 10) {
        underscore.each(room.users, function(value, key, list) {
          if (value === "venter") {
            return venterId = key;
          } else {
            if (value === "listener") return listenerId = key;
          }
        });
        return feedbackServer.addFeedback({
          venter: venterId,
          listener: listenerId,
          direction: "positive"
        });
      }
    });
    return [numListeners, numVenters];
  };

  Room.get = function(id) {
    return rooms[id] || null;
  };

  Room.addUserToQueue = function(userId, type, requestedPartnerId, priority) {
    var queue, user;
    if (!userId) {
      throw new Error("Improper userId");
    } else {
      if (!VALID_TYPES[type]) throw new Error("Unknown type: " + type);
    }
    if (userIdToRoomId[userId]) return;
    if (venterQueue.indexOf(userId) !== -1 || listenerQueue.indexOf(userId) !== -1) {
      return;
    }
    user = User.getById(userId);
    if (DEVELOPMENT && (user.getIPAddress() === "" || user.getIPAddress() === "127.0.0.1")) {
      user.setIPAddress((type === "venter" ? "123.123.123.123" : "1.2.3.4"));
    }
    queue = (type === "venter" ? venterQueue : listenerQueue);
    if (priority) {
      console.log("prioritizing user " + userId);
      queue.unshift(userId);
    } else {
      queue.push(userId);
    }
    if (requestedPartnerId) {
      queueRequestedPartners[userId] = {
        timeout: Date.now() + REQUESTED_PARTNER_TIMEOUT,
        partnerId: requestedPartnerId
      };
    }
    return Room.checkQueues();
  };

  Room.removeUserFromQueue = function(userId) {
    var index;
    index = venterQueue.indexOf(userId);
    if (index !== -1) venterQueue.splice(index, 1);
    index = listenerQueue.indexOf(userId);
    if (index !== -1) listenerQueue.splice(index, 1);
    return delete queueRequestedPartners[userId];
  };

  Room.checkQueues = function() {
    var i, j, lenI, lenJ, listener, listenerId, listenerRequestedPartner, now, venter, venterId, venterRequestedPartner;
    if (venterQueue.length === 0 || listenerQueue.length === 0) return;
    now = Date.now();
    i = 0;
    lenI = venterQueue.length;
    while (i < lenI) {
      venterId = venterQueue[i];
      venter = User.getById(venterId);
      if (venter && venter.isClientConnected()) {
        venterRequestedPartner = queueRequestedPartners[venterId];
        if (venterRequestedPartner) {
          if (venterRequestedPartner.timeout < now) {
            delete queueRequestedPartners[venterId];
            venterRequestedPartner = undefined;
          }
        }
        j = 0;
        lenJ = listenerQueue.length;
        while (j < lenJ) {
          listenerId = listenerQueue[j];
          listener = User.getById(listenerId);
          if (listener && listener.isClientConnected()) {
            listenerRequestedPartner = queueRequestedPartners[listenerId];
            if (listenerRequestedPartner) {
              if (listenerRequestedPartner.timeout < now) {
                delete queueRequestedPartners[listenerId];
                listenerRequestedPartner = undefined;
              }
            }
            if (!userInteractions[venterId] || userInteractions[venterId].indexOf(listenerId) === -1) {
              if (venterRequestedPartner && User.getByPublicId(venterRequestedPartner.partnerId) !== listener) {
                continue;
              } else {
                if (listenerRequestedPartner && User.getByPublicId(listenerRequestedPartner.partnerId) !== venter) {
                  continue;
                }
              }
              new Room(guid(), venterId, listenerId);
              setTimeout(Room.checkQueues, 500);
              return;
            }
          }
          j += 1;
        }
      }
      i += 1;
    }
  };

  Room.getByUserId = function(userId) {
    var roomId;
    roomId = userIdToRoomId[userId];
    if (!roomId) return null;
    return Room.get(roomId);
  };

  Room.dumpData = function() {
    var result, room, roomId;
    result = [];
    for (roomId in rooms) {
      room = rooms[roomId];
      result.push({
        id: roomId,
        clients: room.users,
        time: room.lastAccessTime,
        startTime: room.startTime,
        numMessages: room.numMessages
      });
    }
    return {
      rooms: result,
      listenerQueue: listenerQueue,
      venterQueue: venterQueue
    };
  };

  Room.getQueuePosition = function(userId) {
    var competitorId, i, index, j, len, otherId, otherQueue, queue, user_type;
    index = venterQueue.indexOf(userId);
    queue = void 0;
    otherQueue = void 0;
    user_type = void 0;
    if (index !== -1) {
      user_type = "venter";
      queue = venterQueue;
      otherQueue = listenerQueue;
    } else {
      index = listenerQueue.indexOf(userId);
      if (index === -1) return -1;
      user_type = "listener";
      queue = listenerQueue;
      otherQueue = venterQueue;
    }
    i = 0;
    while (i < index) {
      competitorId = queue[i];
      if (queueRequestedPartners[competitorId]) {
        index -= 1;
      } else {
        j = 0;
        len = otherQueue.length;
        while (j < len) {
          otherId = otherQueue[j];
          if (userInteractions[otherId] && userInteractions[otherId].indexOf(competitorId) !== -1 && userInteractions[otherId].indexOf(userId) === -1) {
            index -= 1;
            break;
          }
          j += 1;
        }
      }
      i += 1;
    }
    if (index < 0) index = 0;
    return {
      queue_position: index,
      user_type: user_type
    };
  };

  Room.prototype.deleteRoom = function(type, reason) {
    var clientType, conversation, userId, users;
    log.info({
      event: "Delete room",
      room: this.id
    });
    delete rooms[this.id];
    users = this.users;
    for (userId in users) {
      clientType = users[userId];
      if (userIdToRoomId[userId] === this.id) delete userIdToRoomId[userId];
      log.store("leaveRoom", userId);
      Room.addUserToQueue(userId, clientType);
    }
    conversation = this.conversation;
    conversation.status = "complete";
    conversation.finishTime = Date.now();
    if (type === "venter" || type === "listener") {
      if (reason === "disconnect") {
        conversation.finishReason = type + "Disconnect";
      } else if (reason === "request") {
        conversation.finishReason = type + "Request";
      } else if (reason === "abuse") {
        conversation.finishReason = type + "ReportedAbuse";
      } else {
        conversation.finishReason = "unknown";
      }
    } else {
      conversation.finishReason = "unknown";
    }
    return saveConversation(conversation);
  };

  Room.prototype.poke = function() {
    return this.lastAccessTime = Date.now();
  };

  Room.prototype.hasType = function(type) {
    return !!this.types[type];
  };

  Room.prototype.isFull = function() {
    var type;
    for (type in VALID_TYPES) {
      if (!this.hasType(type)) return false;
    }
    return true;
  };

  Room.prototype.getNumUsersOfType = function(type) {
    return this.types[type] || 0;
  };

  Room.prototype.hasAnyUsers = function() {
    return Object.keys(this.users).length > 0;
  };

  Room.prototype.getNumUsers = function() {
    var count;
    count = 0;
    count = Object.keys(this.users).length;
    return count;
  };

  Room.prototype.isExpired = function() {
    return this.lastAccessTime < Date.now() - EXPIRY_TIME;
  };

  Room.prototype.sendToUser = function(userId, type) {
    var message, user;
    user = User.getById(userId);
    if (!user) return;
    message = {
      t: type
    };
    if (arguments_.length > 2) {
      if (arguments_.length === 3) {
        message.d = arguments_[2];
      } else {
        message.d = Array.prototype.slice.call(arguments_, 2);
      }
    }
    return user.send(message);
  };

  Room.prototype.receiveMessage = function(userId, message, callback) {
    var clientType, otherUserId;
    this.poke();
    clientType = this.users[userId];
    if (!clientType || !VALID_TYPES[clientType]) {
      callback(false);
      return;
    }
    log.info({
      event: "Chat",
      user: userId,
      room: this.id,
      type: clientType
    });
    this.numMessages += 1;
    for (otherUserId in this.users) {
      if (otherUserId !== userId) {
        this.sendToUser(otherUserId, "msg", clientType, message);
      }
    }
    this.conversation.messages.push({
      partner: clientType,
      text: message
    });
    saveConversation(this.conversation);
    return callback(true);
  };

  Room.prototype.sendTypeStatus = function(userId, message, callback) {
    var clientType, otherUserId;
    this.poke();
    clientType = this.users[userId];
    if (!clientType || !VALID_TYPES[clientType]) {
      callback(false);
      return;
    }
    log.info({
      event: "Typing",
      user: userId,
      room: this.id,
      type: clientType
    });
    for (otherUserId in this.users) {
      if (otherUserId !== userId) {
        this.sendToUser(otherUserId, "typing", clientType, message);
      }
    }
    return callback(true);
  };

  Room.prototype.lookupUserGeoIP = function(userId, callback) {
    var user;
    user = User.getById(userId);
    if (!user) {
      return callback(null);
    } else {
      return user.lookupGeoIP(callback);
    }
  };

  Room.prototype.areUsersFromSameCountry = function(userId, otherUserId, callback) {
    var self;
    self = this;
    return self.lookupUserGeoIP(userId, function(geoInfo) {
      if (geoInfo && geoInfo.data && geoInfo.data.country_name) {
        self.lookupUserGeoIP(otherUserId, function(geoInfo2) {
          if (geoInfo2 && geoInfo2.data && geoInfo2.data.country_name && geoInfo2.data.country_name === geoInfo.data.country_name) {
            console.log("They are from Same country.!!");
            callback(geoInfo);
          }
        });
      }
      console.log("They are NOT from same country.");
      callback(null);
    });
  };

  Room.prototype.addUser = function(userId, type) {
    var oldRoom, oldRoomId, self;
    if (!VALID_TYPES[type]) throw new Error("Unknown type: " + type);
    oldRoomId = userIdToRoomId[userId];
    if (oldRoomId) {
      if (oldRoomId === this.id) return;
      delete userIdToRoomId[userId];
      oldRoom = Room.get(oldRoomId);
      if (oldRoom) oldRoom.removeUser(userId);
    }
    log.info({
      event: "Add user",
      user: userId,
      room: this.id,
      type: type
    });
    userIdToRoomId[userId] = this.id;
    this.users[userId] = type;
    this.types[type] += 1;
    if (this.types[type] !== 1) {
      throw new Error("Expected this.types[" + JSON.stringify(type) + "] == 1, got " + this.types[type]);
    }
    self = this;
    Object.keys(this.users).forEach(function(otherUserId) {
      if (otherUserId !== userId) {
        return self.areUsersFromSameCountry(userId, otherUserId, function(geoInfo) {
          var otherClientType, otherUser, user;
          user = User.getById(userId);
          self.sendToUser(otherUserId, "join", user && user.publicId, type, geoInfo);
          otherClientType = self.users[otherUserId];
          if (VALID_TYPES[otherClientType]) {
            otherUser = User.getById(otherUserId);
            if (otherClientType === "venter") {
              self.sendToUser(userId, "join", otherUser && otherUser.publicId, otherClientType, null);
            } else {
              self.lookupUserGeoIP(otherUserId, function(geoInfo) {
                return self.sendToUser(userId, "join", otherUser && otherUser.publicId, otherClientType, geoInfo);
              });
            }
            console.log("other client type", otherClientType);
          }
          (userInteractions[userId] || (userInteractions[userId] = [])).push(otherUserId);
          return (userInteractions[otherUserId] || (userInteractions[otherUserId] = [])).push(userId);
        });
      }
    });
    return Room.removeUserFromQueue(userId);
  };

  Room.prototype.removeUser = function(userId, reason) {
    var clientType, self, userIds, users;
    self = this;
    clientType = this.users[userId];
    if (clientType) {
      log.info({
        event: "Remove user",
        user: userId,
        room: this.id,
        type: clientType || "unknown"
      });
      if (clientType in this.types) {
        this.types[clientType] -= 1;
        if (this.types[clientType] !== 0) {
          throw new Error("Expected this.types[" + JSON.stringify(clientType) + "] == 0, got " + this.types[clientType]);
        }
      }
    }
    users = this.users;
    delete users[userId];
    delete userIdToRoomId[userId];
    if (this.hasAnyUsers()) {
      console.log("trashing room %s due to user disconnect", this.id);
      userIds = Object.keys(users);
      return async.forEach(userIds, (function(user, callback) {
        if (reason === "disconnect") {
          console.log("dropping user %s from room", user);
          delete users[user];
          delete userIdToRoomId[user];
          console.log("sending partDisconnect message to %s", user);
          self.sendToUser(user, "partDisconnect", clientType || "unknown");
        } else {
          console.log("sending partRequest message to %s", user);
          self.sendToUser(user, "partRequest", clientType || "unknown");
        }
        return callback();
      }), function(err) {
        var remaining;
        remaining = Object.keys(users);
        console.log("%s room deconstruction complete, users remaining: %s", reason, remaining.join(", "));
        return self.deleteRoom(clientType || "unknown", reason);
      });
    } else {
      return this.deleteRoom(clientType || "unknown", reason);
    }
  };

}).call(this);
