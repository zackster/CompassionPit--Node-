/*jshint devel: true, forin: false */

(function () {
    "use strict";
    
    var log = require("../log"),
        guid = require("../utils").guid,
        createHash = require("../utils").createHash,
        forceLatency = require("../utils").forceLatency,
        User = require("../users/models").User;
    
    var has = Object.prototype.hasOwnProperty;
    
    /**
     * The amount of time between activities until the room is considered expired.
     */
    var EXPIRY_TIME = 60 * 1000; // 60 secs
    
    /**
     * A hash of roomId to Room
     */
    var rooms = createHash();
    
    /**
     * A hash of valid listener types
     */
    var VALID_TYPES = createHash({
        venter: true,
        listener: true
    }, true);
    
    /**
     * The queue of listener userIDs that are waiting for a partner.
     */
    var listenerQueue = [];
    /**
     * The queue of venter userIDs that are waiting for a partner.
     */
    var venterQueue = [];
    
    /**
     * a simple hash of userId to roomId
     */
    var userIdToRoomId = createHash();
    /**
     * A hash of userId to other userIds that there has been an interaction with, to prevent talking to the same
     * person.
     */
    var userInteractions = createHash();
    
    /**
     * Create a Room object
     *
     * @param {String} id The unique identifier of the room
     */
    var Room = exports.Room = function (id) {
        if (!(this instanceof Room)) {
            return new Room(id);
        }
        id = String(id);
        this.id = id;
        this.sessionTime = this.lastAccessTime = Date.now();
        this.users = createHash();
        this.types = createHash({
            venter: 0,
            listener: 0
        });
        
        rooms[id] = this;
        
        log.info({
            event: "New room",
            room: id
        });
    };
    
    /**
     * Loop through all existing rooms
     *
     * @param {Function} callback A function that takes the Room and its id. If it returns false, exit early.
     */
    Room.forEach = function (callback) {
        for (var key in rooms) {
            if (callback(rooms[key], key) === false) {
                return;
            }
        }
    };
    
    /**
     * Calculate the number of listeners and venters in the system
     *
     * @return {Array} an array containing [numListeners, numVenters]
     */
    Room.calculateCounts = function () {
        var numListeners = listenerQueue.length;
        var numVenters = venterQueue.length;

        Room.forEach(function (room, id) {
            numListeners += room.getNumUsersOfType("listener");
            numVenters += room.getNumUsersOfType("venter");
        });
        
        return [numListeners, numVenters];
    };
    
    /**
     * Get the Room identified by the provided id
     *
     * @param {String} id The identifier of the Room.
     * @return the Room or null.
     */
    Room.get = function (id) {
        return rooms[id] || null;
    };
    
    /**
     * Add the provided userId to the queue of its type
     *
     * @param {String} userId The unique user identifier
     * @param {String} type The client type, either "venter" or "listener"
     */
    Room.addUserToQueue = function (userId, type) {
        if (!userId) {
            throw new Error("Improper userId");
        } else if (!VALID_TYPES[type]) {
            throw new Error("Unknown type: " + type);
        }
        
        if (userIdToRoomId[userId]) {
            // in a room already
            return;
        }
        
        if (venterQueue.indexOf(userId) !== -1 || listenerQueue.indexOf(userId) !== -1) {
            // in a queue already
            return;
        }
        
        var queue = type === "venter" ? venterQueue : listenerQueue;
        queue.push(userId);
         
        Room.checkQueues();
    };
    
    /**
     * Remove the provided userId from all queues
      *
      * @param {String} userId The unique user identifier
     */
    Room.removeUserFromQueue = function (userId) {
        var index = venterQueue.indexOf(userId);
        if (index !== -1) {
            venterQueue.splice(index, 1);
        }
        index = listenerQueue.indexOf(userId);
        if (index !== -1) {
            listenerQueue.splice(index, 1);
        }
    };
    
    /**
     * Check the queues and create rooms if necessary
     */
    Room.checkQueues = function () {
        if (venterQueue.length === 0 || listenerQueue.length === 0) {
            // at least one is empty, nothing to do.
            return;
        }
        
        for (var i = 0, lenI = venterQueue.length; i < lenI; i += 1) {
            var venterId = venterQueue[i];
            var venter = User.getById(venterId);
            if (venter && venter.isClientConnected()) {
                // venter exists and the client is still connected
                for (var j = 0, lenJ = listenerQueue.length; j < lenJ; j += 1) {
                    var listenerId = listenerQueue[j];
                    var listener = User.getById(listenerId);
                    if (listener && listener.isClientConnected()) {
                        // listener exists and the client is still connected
                        if (!userInteractions[venterId] || userInteractions[venterId].indexOf(listenerId) === -1) {
                            // the venter is either new (and can be paired with anyone) or has not talked with the listener
                            // before
                            var room = new Room(guid());
                            room.addUser(venterId, "venter");
                            room.addUser(listenerId, "listener");
                
                            return Room.checkQueues();
                        }
                    }
                }
            }
        }
    };
    
    /**
     * Get the Room with the provided userId in it.
     *
      * @param {String} userId The unique identifier of the user.
      * @return the Room or null.
     */
    Room.getByUserId = function (userId) {
        var roomId = userIdToRoomId[userId];
        if (!roomId) {
            return null;
        }
        
        return Room.get(roomId);
    };
    
    /**
     * Dump debug data of all the current Rooms.
     *
     * @return {Array} An Array of Objects with the form {id: "roomId", users: [{"clientId": "venter", "otherClientId": "listener"}, time: 123456789]}
     */
    Room.dumpData = function () {
        var result = [];
        for (var roomId in rooms) {
            var room = rooms[roomId];
            result.push({
                id: roomId,
                clients: room.users,
                time: room.lastAccessTime
            });
        }
        return {
            rooms: result,
            listenerQueue: listenerQueue,
            venterQueue: venterQueue
        };
    };
    
    /**
     * Calculate the current queue position of the provided user.
     *
     * @param {String} userId the userId to check for its type.
     * @return {Number} The index in the queue. 0-based. If -1 is returned, not in a queue.
     */
    Room.getQueuePosition = function (userId) {
        var index = venterQueue.indexOf(userId);
        if (index === -1) {
            index = listenerQueue.indexOf(userId);
        }
        return index;
    };
    
    /**
     * Delete the current room. Adds any current users to their appropriate queues.
     */
    Room.prototype.delete = function () {
        log.info({
            event: "Delete room",
            room: this.id
        });
        delete rooms[this.id];
        
        var users = this.users;
        for (var userId in users) {
            var clientType = users[userId];
            if (userIdToRoomId[userId] === this.id) {
                delete userIdToRoomId[userId];
            }
            
            Room.addUserToQueue(userId, clientType);
        }
    };
    
    /**
     * Update the lastAccessTime of the Room.
     */
    Room.prototype.poke = function () {
        this.lastAccessTime = Date.now();
    };
    
    /**
     * Return whether the Room has the provided client type in it already.
     *
     * @param {String} type The client type, either "venter" or "listener".
     * @return {Boolean} whether the client type is in the Room.
     */
    Room.prototype.hasType = function (type) {
        return !!this.types[type];
    };
    
    /**
     * Return whether all expected client types are in the Room.
     *
     * @return {Boolean} whether all client types are present in the Room.
     */
    Room.prototype.isFull = function () {
        for (var type in VALID_TYPES) {
            if (!this.hasType(type)) {
                return false;
            }
        }
        return true;
    };
    
    /**
     * Return the number of clients of the provided type in the Room.
     *
     * @param {String} type The client type. Either "venter" or "listener"
     * @return {Number} The number of clients. Should always be 0 or 1.
     */
    Room.prototype.getNumUsersOfType = function (type) {
        return this.types[type] || 0;
    };
    
    /**
     * Return whether at least 1 user is present in the Room.
     *
     * @return {Boolean} Whether the Room has at least 1 user.
     */
    Room.prototype.hasAnyUsers = function () {
        for (var userId in this.users) {
            return true;
        }
        return false;
    };
    
    /**
     * Return the number of users present in the Room.
     *
     * @return {Number} The number of users. Should be 0, 1, or 2.
     */
    Room.prototype.getNumUsers = function () {
        var count = 0;
        for (var userId in this.users) {
            count += 1;
        }
        return count;
    };
    
    /**
     * Return whether the Room has had no activity for the past EXPIRY_TIME.
     *
     * @return {Boolean} Whether the Room can be considered "expired".
     */
    Room.prototype.isExpired = function () {
        return this.lastAccessTime < Date.now() - EXPIRY_TIME;
    };
    
    /**
     * Send a raw message to the provided user. Any parameters after type are included in the message.
     *
     * @param {String} userId the unique identifier of the user
     * @param {String} type the message type
     */
    Room.prototype.sendToUser = function (userId, type) {
        var user = User.getById(userId);
        if (!user) {
            return;
        }
        
        var message = {t: type};
        if (arguments.length > 2) {
            if (arguments.length === 3) {
                message.d = arguments[2];
            } else {
                message.d = Array.prototype.slice.call(arguments, 2);
            }
        }
        user.send(message);
    };
    
    /**
     * Receive a message from the user
     *
     * @param {String} message The chat message
     * @param {String} userId The unique identifier of the user
     * @param {Function} callback The callback to inform the user of success.
     */
    Room.prototype.receiveMessage = function (userId, message, callback) {
        this.poke();
        
        var clientType = this.users[userId];
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
        for (var otherUserId in this.users) {
            if (otherUserId !== userId) {
                this.sendToUser(otherUserId, "msg", clientType, message);
            }
        }
        
        callback(true);
    };
    
    Room.prototype.lookupUserGeoIP = function (userId, callback) {
        var user = User.getById(userId);
        if (!user) {
            callback(null);
        } else {
            user.lookupGeoIP(callback);
        }
    };
    
    /**
     * Add the provided user to the Room.
     *
     * @param {String} userId The user's unique identifier.
     * @param {String} type The client type, either "venter" or "listener".
     */
    Room.prototype.addUser = function (userId, type) {
        if (!VALID_TYPES[type]) {
            throw new Error("Unknown type: " + type);
        }
        
        var oldRoomId = userIdToRoomId[userId];
        if (oldRoomId) {
            if (oldRoomId === this.id) {
                return;
            }
            delete userIdToRoomId[userId];
            var oldRoom = Room.get(oldRoomId);
            if (oldRoom) {
                oldRoom.removeUser(userId);
            }
        }
        
        log.info({
            event: "Add user",
            user: userId,
            room: this.id,
            type: type
        });
        
        userIdToRoomId[userId] = this.id;
        this.sessionTime = Date.now();
        this.users[userId] = type;
        this.types[type] += 1;

        var self = this;
        
        // let the new user know about the other users in the room.
        Object.keys(this.users).forEach(function (otherUserId) {
            if (otherUserId !== userId) {
                // let the old user know that the new one has joined
                var user = User.getById(userId);
                self.lookupUserGeoIP(userId, function (geoInfo) {
                    self.sendToUser(otherUserId, "join", type, geoInfo);
                });
                var otherClientType = self.users[otherUserId];
                if (VALID_TYPES[otherClientType]) {
                    // let the new user know about the existing old users
                    self.lookupUserGeoIP(otherUserId, function (geoInfo) {
                        self.sendToUser(userId, "join", otherClientType, geoInfo);
                    });
                }
                
                (userInteractions[userId] || (userInteractions[userId] = [])).push(otherUserId);
                (userInteractions[otherUserId] || (userInteractions[otherUserId] = [])).push(userId);
            }
        });
        
        Room.removeUserFromQueue(userId);
    };
    
    /**
     * Remove the provided user from the Room.
     *
     * @param {String} userId The unique identifer of the user to remove.
     */
    Room.prototype.removeUser = function (userId) {
        var clientType = this.users[userId];
        if (clientType) {
            log.info({
                event: "Remove user",
                user: userId,
                room: this.id,
                type: clientType || 'unknown'
            });
            if (clientType in this.types) {
                this.types[clientType] -= 1;
            }
        }
        
        this.sessionTime = Date.now();
        
        var users = this.users;
        delete users[userId];
        delete userIdToRoomId[userId];
        if (this.hasAnyUsers()) {
            for (var otherUserId in users) {
                this.sendToUser(otherUserId, "part", clientType || 'unknown');
            }
        }
        this.delete();
    };
}());
