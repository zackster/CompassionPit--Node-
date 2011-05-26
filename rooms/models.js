/*jshint devel: true */

(function () {
    "use strict";
    
    var log = require("../log"),
        guid = require("../utils").guid,
        createHash = require("../utils").createHash,
        forceLatency = require("../utils").forceLatency,
        geoip = require('geoip');
    
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
     * The queue of listener clientIDs that are waiting for a partner.
     */
    var listenerQueue = [];
    /**
     * The queue of venter clientIDs that are waiting for a partner.
     */
    var venterQueue = [];
    
    /**
     * a simple hash of clientId to roomId
     */
    var clientIdToRoomId = createHash();
    /**
     * A hash of clientId to other clientIds that there has been an interaction with, to prevent talking to the same
     * person.
     */
    var clientInteractions = createHash();
    
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
        this.socket = require("../app").socket;
        this.clients = createHash();
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
            numListeners += room.getNumClientsOfType("listener");
            numVenters += room.getNumClientsOfType("venter");
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
     * Add the provided clientId to the queue of its type
     *
     * @param {String} clientId The unique client identifier
     * @param {String} type The client type, either "venter" or "listener"
     */
    Room.addClientToQueue = function (clientId, type) {
        if (!clientId) {
            throw new Error("Improper clientId");
        } else if (!VALID_TYPES[type]) {
            throw new Error("Unknown type: " + type);
        }
        
        if (clientIdToRoomId[clientId]) {
            // in a room already
            return;
        }
        
        if (venterQueue.indexOf(clientId) !== -1 || listenerQueue.indexOf(clientId) !== -1) {
            // in a queue already
            return;
        }
        
        var queue = type === "venter" ? venterQueue : listenerQueue;
        queue.push(clientId);
         
        Room.checkQueues();
    };
    
    /**
     * Remove the provided clientId from all queues
      *
      * @param {String} clientId The unique client identifier
     */
    Room.removeClientFromQueue = function (clientId) { 
        var index = venterQueue.indexOf(clientId);
        if (index !== -1) {
            venterQueue.splice(index, 1);
        }
        index = listenerQueue.indexOf(clientId);
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
            for (var j = 0, lenJ = listenerQueue.length; j < lenJ; j += 1) {
                var listenerId = listenerQueue[j];
                
                if (!clientInteractions[venterId] || clientInteractions[venterId].indexOf(listenerId) === -1) {
                    // the venter is either new (and can be paired with anyone) or has not talked with the listener
                    // before
                    var room = new Room(guid());
                    room.addUser(venterId, "venter");
                    room.addUser(listenerId, "listener");
                    
                    return Room.checkQueues();
                }
            }
        }
    };
    
    /**
     * Get the Room with the provided clientId in it.
     *
      * @param {String} clientId The unique identifier of the client.
      * @return the Room or null.
     */
    Room.getByClientId = function (clientId) {
        var roomId = clientIdToRoomId[clientId];
        if (!roomId) {
            return null;
        }
        
        return Room.get(roomId);
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
        return {
            rooms: result,
            listenerQueue: listenerQueue,
            venterQueue: venterQueue
        };
    };
    
    /**
     * Calculate the current queue position of the provided client.
     *
     * @param {String} clientId the clientId to check for its type.
     * @return {Number} The index in the queue. 0-based. If -1 is returned, not in a queue.
     */
    Room.getQueuePosition = function (clientId) {
        var index = venterQueue.indexOf(clientId);
        if (index === -1) {
            index = listenerQueue.indexOf(clientId);
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
        
        var clients = this.clients;
        for (var clientId in clients) {
            var clientType = clients[clientId];
            if (clientIdToRoomId[clientId] === this.id) {
                delete clientIdToRoomId[clientId];
            }
            
            Room.addClientToQueue(clientId, clientType);
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
     * Return the IP Address of the provided clientId
     *
     * @param {String} clientId The IP Address of the client
     * @return {String} The IP Address or null
     */
    Room.prototype.getClientIPAddress = function (clientId) {
        var client = this.socket.clients[clientId];
        if (!client) {
            return null;
        }
        
        var ipAddress;
        
        var request = client.request;
        if (request) {
            var headers = request.headers;
            if (headers) {
                ipAddress = headers['x-forwarded-for'];
            }
        }
        if (!ipAddress) {
            var connection = client.connection;
            if (connection) {
                ipAddress = connection.remoteAddress;
            }
        }
        return ipAddress || null;
    };
    
    var geoipCity = new geoip.City(__dirname + '/../GeoLiteCity.dat');
    
    Room.prototype.lookupClientGeoIP = function (clientId, callback) {
        var ipAddress = this.getClientIPAddress(clientId);
        if (!ipAddress || ipAddress === "127.0.0.1") {
            callback(null);
        } else {
            geoipCity.lookup(function (err, data) {
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
                
                var parts = [
                    data.city,
                    data.region,
                    data.country_name
                ];
                var result = parts.filter(function (x) {
                    return !!x;
                }).join(", ");
                
                callback(result);
            });
        }
    };
    
    /**
     * Send a raw message to the provided client. Any parameters after type are included in the message.
     *
     * @param {String} clientId the unique identifier of the client
     * @param {String} type the message type
     */
    Room.prototype.sendToClient = function (clientId, type) {
        var client = this.socket.clients[clientId];
        if (!client) {
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
        forceLatency(function () {
            client.send(message);
        });
    };
    
    /**
     * Receive a message from the client
     * 
     * @param {String} message The chat message
     * @param {String} clientId The unique identifier of the client
     * @param {Function} callback The callback to inform the client of success.
     */
    Room.prototype.receiveMessage = function (clientId, message, callback) {
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
        for (var otherClientId in this.clients) {
            if (otherClientId !== clientId) {
                this.sendToClient(otherClientId, "msg", clientType, message);
            }
        }
        
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
        
        var oldRoomId = clientIdToRoomId[clientId];
        if (oldRoomId) {
            if (oldRoomId === this.id) {
                return;
            }
            delete clientIdToRoomId[clientId];
            var oldRoom = Room.get(oldRoomId);
            if (oldRoom) {
                oldRoom.removeUser(clientId);
            }
        }
        
        log.info({
            event: "Add user",
            client: clientId,
            room: this.id,
            type: type
        });
        
        clientIdToRoomId[clientId] = this.id;
        this.sessionTime = Date.now();
        this.clients[clientId] = type;
        this.types[type] += 1;

        var self = this;
        
        // let the new client know about the other clients in the room.
        Object.keys(this.clients).forEach(function (otherClientId) {
            if (otherClientId !== clientId) {
                // let the old client know that the new one has joined
                self.lookupClientGeoIP(clientId, function (geoInfo) {
                    self.sendToClient(otherClientId, "join", type, geoInfo);
                });
                var otherClientType = self.clients[otherClientId];
                if (VALID_TYPES[otherClientType]) {
                    // let the new client know about the existing old clients
                    self.lookupClientGeoIP(otherClientId, function (geoInfo) {
                        self.sendToClient(clientId, "join", otherClientType, geoInfo);
                    });
                }
                
                (clientInteractions[clientId] || (clientInteractions[clientId] = [])).push(otherClientId);
                (clientInteractions[otherClientId] || (clientInteractions[otherClientId] = [])).push(clientId);
            }
        });
        
        Room.removeClientFromQueue(clientId);
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
        
        var clients = this.clients;
        delete clients[clientId];
        delete clientIdToRoomId[clientId];
        if (this.hasAnyClients()) {
            for (var otherClientId in clients) {
                this.sendToClient(otherClientId, "part", clientType || 'unknown');
            }
        }
        this.delete();
    };
}());
