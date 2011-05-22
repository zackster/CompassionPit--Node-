/*jshint devel: true */

(function () {
    "use strict";
    
    var nowjs = require("now"),
        log = require("../log"),
        guid = require("../utils").guid,
        createHash = require("../utils").createHash;
    
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
     * The queue of rooms that need a listener to join.
     */
    var listenerRoomQueue = [];
    /**
     * The queue of rooms that need a venter to join.
     */
    var venterRoomQueue = [];
    
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
        this.group = nowjs.getGroup(id);
        this.clients = createHash();
        this.types = createHash({
            venter: 0,
            listener: 0
        });
        
        rooms[id] = this;
        // add the current room to both the listener and venter queue
        // very soon after Room creation, a user will be added to one of these.
        listenerRoomQueue.push(this);
        venterRoomQueue.push(this);
        
        log.info({
            event: "New room",
            room: id
        });
        
        var room = this;
        this.group.on('connect', function (clientId) {
            room.onConnect(this, clientId);
        });

        this.group.on('disconnect', function (clientId) {
            room.onDisconnect(this, clientId);
        });
    };
    
    /**
     * Loop throuh all existing rooms
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
     * Get the Room identified by the provided id
     * 
     * @param {String} id The identifier of the Room.
     * @return the Room or null.
     */
    Room.get = function (id) {
        return rooms[id] || null;
    };
    
    /**
     * Find a new Room to enter based on the type needed.
     * If oldRoomId is provided, the client will not be placed back into that same room.
     * 
     * @param {String} type The client type, either "venter" or "listener"
     * @param {String} oldRoomId The last room the client was in.
     */
    Room.findOrCreate = function (type, oldRoomId) {
        if (!VALID_TYPES[type]) {
            throw new Error("Unknown type: " + type);
        }
        
        var queue = type === "venter" ? venterRoomQueue : listenerRoomQueue;
        
        for (var i = 0, len = queue.length; i < len; i += 1) {
            var room = queue[i];
            if (oldRoomId && room.id === oldRoomId) {
                // if they were in an old Room, don't place them back in the same one.
                continue;
            }
            return room;
        }
        
        // couldn't find an existing Room, make a new one.
        return new Room(guid());
    };
    
    /**
     * Dump debug data of all the current Rooms.
     *
     * @return {Array} An Array of Objects with the form {id: "roomId", clients: [{"clientId": "venter", "otherClientId": "listener"}, time: 123456789]}
     */
    Room.dumpData = function () {
        var result = [];
        for (var roomId in rooms) {
            var room = rooms[roomId];
            result.push({
                id: roomId,
                clients: room.clients,
                time: room.lastAccessTime
            });
        }
        return result;
    };
    
    /**
     * Calculate the current queue position of the current room for the provided client.
     *
     * @param {String} clientId the clientId to check for its type.
     * @return {Number} The index in the queue. 0-based. If -1 is returned, not in a queue.
     */
    Room.prototype.getQueuePosition = function (clientId) {
        var type = this.clients[clientId];
        if (!VALID_TYPES[type]) {
            return -1;
        }
        
        var queue = type !== "venter" ? venterRoomQueue : listenerRoomQueue;
        return queue.indexOf(this);
    };
    
    /**
     * Delete the current room, removing it from all queues.
     */
    Room.prototype.delete = function () {
        log.info({
            event: "Delete room",
            room: this.id
        });
        delete rooms[this.id];
        var index = venterRoomQueue.indexOf(this);
        if (index !== -1) {
            venterRoomQueue.splice(index, 1);
        }
        index = listenerRoomQueue.indexOf(this);
        if (index !== -1) {
            listenerRoomQueue.splice(index, 1);
        }
    };
    
    /**
     * Handle when a client connects to the room.
     * 
     * @param {Object} client A nowjs client
     * @param {String} clientId The unique identifier of the client.
     */
    Room.prototype.onConnect = function (client, clientId) {
        if (!this.clients[clientId]) {
            this.clients[clientId] = 'unknown';
        }
        
        // let the new client know about the other clients in the room.
        for (var otherClientId in this.clients) {
            if (otherClientId !== clientId) {
                var otherClientType = this.clients[otherClientId];
                if (VALID_TYPES[otherClientType]) {
                    client.now.receive([
                        {
                            action: 'join',
                            type: otherClientType
                        }
                    ]);
                }
            }
        }
    };
    
    /**
     * Handle when a client disconnects from the room.
     *
     * @param {Object} client A nowjs client
     * @param {String} clientId The unique identifier of the client.
     */
    Room.prototype.onDisconnect = function (client, clientId) {
        var clients = this.clients;
        delete clients[clientId];
        for (var key in clients) {
            // have at least one still in.
            return;
        }
        // didn't find any clients
        this.delete();
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
    Room.prototype.getNumClientsOfType = function (type) {
        return this.types[type] || 0;
    };
    
    /**
     * Return whether at least 1 client is present in the Room.
     *
     * @return {Boolean} Whether the Room has at least 1 client.
     */
    Room.prototype.hasAnyClients = function () {
        for (var clientId in this.clients) {
            return true;
        }
        return false;
    };
    
    /**
     * Return the number of clients present in the Room.
     *
     * @return {Number} The number of clients. Should be 0, 1, or 2.
     */
    Room.prototype.getNumClients = function () {
        var count = 0;
        for (var clientId in this.clients) {
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
     * Receive a message from the client
     * 
     * @param {String} message The chat message
     * @param {String} clientId The unique identifier of the client
     * @param {Function} callback The callback to inform the client of success.
     */
    Room.prototype.send = function (message, clientId, callback) {
        this.poke();
        
        var clientType = this.clients[clientId];
        if (!clientType || !VALID_TYPES[clientType]) {
            callback(false);
            return;
        }
        
        log.info({
            event: "Chat",
            client: clientId,
            room: this.id,
            type: clientType
        });
        this.group.now.receive([{
            action: "message",
            type: clientType,
            data: message
        }]);
        
        callback(true);
    };
    
    /**
     * Add the provided client to the Room.
     *
     * @param {String} clientId The client's unique identifier.
     * @param {String} type The client type, either "venter" or "listener".
     */
    Room.prototype.addUser = function (clientId, type) {
        if (!VALID_TYPES[type]) {
            throw new Error("Unknown type: " + type);
        }
        
        log.info({
            event: "Add user",
            client: clientId,
            room: this.id,
            type: type
        });
        if (this.hasAnyClients()) {
            this.group.now.receive([
                {
                    action: 'join',
                    type: type
                }
            ]);
        }
        this.sessionTime = Date.now();
        this.clients[clientId] = type;
        this.types[type] += 1;
        this.group.addUser(clientId);
        
        var queue = type === "venter" ? venterRoomQueue : listenerRoomQueue;
        
        var index = queue.indexOf(this);
        if (index !== -1) {
            queue.splice(index, 1);
        }
    };
    
    /**
     * Remove the provided client from the Room.
     *
     * @param {String} clientId The unique identifer of the client to remove.
     */
    Room.prototype.removeUser = function (clientId) {
        var clientType = this.clients[clientId];
        if (clientType) {
            log.info({
                event: "Remove user",
                client: clientId,
                room: this.id,
                type: clientType || 'unknown'
            });
            if (clientType in this.types) {
                this.types[clientType] -= 1;
            }
        }
        
        this.sessionTime = Date.now();
        this.group.removeUser(clientId);
        if (this.hasAnyClients()) {
            this.group.now.receive([
                {
                    type: clientType || 'unknown',
                    action: 'disconnect'
                }
            ]);
            var queue = clientType === "venter" ? venterRoomQueue : listenerRoomQueue;
            if (queue.indexOf(this) === -1) {
                queue.push(this);
            }
        }
    };
}());
