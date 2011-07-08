/*jshint devel: true */

(function () {
    "use strict";
    
    var log = require("../log"),
        createHash = require("../utils").createHash,
        guid = require("../utils").guid,
        config = require("../config"),
        forceLatency = require("../utils").forceLatency,
        geoip = require('geoip');
    
    var userIdToUser = createHash();
    var userPublicIdToUserId = createHash();
    var userIdToSocketIOId = createHash();
    var socketIOIdToUserId = createHash();
    var userIdsWithoutSocketIOClient = createHash();
    
    var User = exports.User = function (socketIOId, id, publicId) {
        if (!(this instanceof User)) {
            throw new Error("Must be called with new");
        }
        this.id = id = id || guid();
        this.publicId = publicId = publicId || guid();
        
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
        this.userAgent = "";
    };
    
    User.getById = function (id) {
        return userIdToUser[id] || null;
    };
    
    User.getByPublicId = function (publicId) {
        var id = userPublicIdToUserId[publicId];
        return id ?
            User.getById(id) :
            null;
    };
    
    User.getBySocketIOId = function (socketIOId) {
        var userId = socketIOIdToUserId[socketIOId];
        return userId ?
            User.getById(userId) :
            null;
    };
    
    User.cleanup = function () {
        var maxDisconnectTime = Date.now();
        var ids = Object.keys(userIdsWithoutSocketIOClient);
        for (var i = 0, len = ids.length; i < len; i += 1) {
            var id = ids[i];
            var user = userIdToUser[id];
            if (user.disconnectTime < maxDisconnectTime) {
                user.delete();
            }
        }
    };

    User.prototype.setSocketIOId = function (newId, lastMessageClientReceived) {
        var oldId = this.socketIOId;
        if (oldId === newId) {
            return;
        }
        delete socketIOIdToUserId[oldId];
        if (newId) {
            userIdToSocketIOId[this.id] = this.socketIOId = newId;
            socketIOIdToUserId[newId] = this.id;
            delete userIdsWithoutSocketIOClient[this.id];
            delete this.disconnectTime;
            this.flushMessageQueue(lastMessageClientReceived);
        } else {
            this.socketIOId = null;
            delete userIdToSocketIOId[this.id];
            userIdsWithoutSocketIOClient[this.id] = true;
            this.disconnectTime = Date.now() + config.disconnectLeeway;
        }
    };
    
    User.prototype.isClientConnected = function () {
        var clientId = this.socketIOId;
        if (!clientId) {
            return false;
        }
        
        return !!this.socket.connected[clientId];
    };
    
    User.prototype.disconnect = function (callback) {
        this.disconnectCallbacks.push(callback);
    };
    
    User.prototype.delete = function () {
        for (var i = 0, len = this.disconnectCallbacks.length; i < len; i += 1) {
            this.disconnectCallbacks[i].call(this);
        }
        
        var id = this.id;
        delete userIdsWithoutSocketIOClient[id];
        if (userPublicIdToUserId[this.publicId] === id) {
            delete userPublicIdToUserId[this.publicId];
        }
        var socketIOId = userIdToSocketIOId[id];
        if (socketIOId) {
            delete userIdToSocketIOId[id];
            if (socketIOIdToUserId[socketIOId] === id) {
                delete socketIOIdToUserId[socketIOId];
            }
        }
        delete userIdToUser[id];
    };
    
    /**
     * Return the IP Address of the provided clientId
     *
     * @param {String} clientId The IP Address of the client
     * @return {String} The IP Address or null
     */
    User.prototype.getIPAddress = function () {
        if (this.ipAddress) {
            return this.ipAddress;
        }
        
        var socketIOId = userIdToSocketIOId[this.id];
        if (!socketIOId) {
            return null;
        }
        if (!this.socket.connected[socketIOId]) {
            return null;
        }
        var client = this.socket.of('').socket(socketIOId);
        if (!client) {
            return null;
        }
        
        return (this.ipAddress = client.handshake.address.address);
    };
    
    var geoipCity = new geoip.City(__dirname + '/../GeoLiteCity.dat');
    var configGeoParts = config.geoLocationParts || [];
    
    User.prototype.lookupGeoIP = function (callback) {
        var ipAddress = this.getIPAddress();
        if (!ipAddress || ipAddress === "127.0.0.1") {
            callback(null);
        } else {
            geoipCity.lookup(ipAddress, function (err, data) {
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
                
                var parts = [];
                for (var i = 0, len = configGeoParts.length; i < len; i += 1) {
                    var part = data[configGeoParts[i]];
                    if (part && isNaN(Number(part, 10))) {
                        parts.push(part);
                    }
                }
                
                callback(parts.join(", ") || null);
            });
        }
    };
    
    User.prototype.flushMessageQueue = function (lastMessageClientReceived) {
        var clientId = this.socketIOId;
        if (!clientId) {
            return;
        }
        
        if (!this.socket.connected[clientId]) {
            return;
        }
        
        var client = this.socket.of('').socket(clientId);
        
        var backlog = this.messageBacklog,
            queue = this.messageQueue;
        forceLatency(function () {
            var i,
                len,
                message;
            
            var wholeMessage = [];
            
            if (lastMessageClientReceived) {
                for (i = 0, len = backlog.length; i < len; i += 1) {
                    message = backlog[i];
                    if (message.n > lastMessageClientReceived) {
                        wholeMessage.push(message);
                    }
                }
            }
            
            len = queue.length;
            for (i = 0; i < len; i += 1) {
                message = queue[i];
                wholeMessage.push(message);
                backlog.push(message);
            }
            queue.length = 0;
            if (backlog.length > config.messageBacklogPerUser) {
                backlog.splice(0, backlog.length - config.messageBacklogPerUser);
            }
            
            for (i = 0, len = wholeMessage.length; i < len; i += 1) {
                client.json.send(wholeMessage[i]);
            }
        });
    };
    
    User.prototype.send = function (message) {
        message.n = this.lastSentMessageIndex = this.lastSentMessageIndex + 1;
        this.messageQueue.push(message);
        this.flushMessageQueue();
    };
}());