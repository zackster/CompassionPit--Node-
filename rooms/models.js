/* vi: set ts=4:set expandtab: */
/*jshint devel: true, forin: false */
/*global setTimeout: false */

(function () {
    "use strict";
    
    var log = require("../log"),
        guid = require("../utils").guid,
        createHash = require("../utils").createHash,
        forceLatency = require("../utils").forceLatency,
        User = require("../users/models").User,
        hashIPAddress = require("../utils").hashIPAddress,
        async = require( 'async' );
    
    var has = Object.prototype.hasOwnProperty;
    
    /**
     * The amount of time between activities until the room is considered expired.
     */
    var EXPIRY_TIME = 60 * 1000; // 60 secs
    
    var REQUESTED_PARTNER_TIMEOUT = 10 * 1000; // 10 secs
    
    var mongoose = require('mongoose');
    (function () {
        var Schema = mongoose.Schema;
        var ConversationPartner = {
            userId: { type: String },
            hashedIPAddress: { type: String },
            geoLocation: {},
            userAgent: { type: String }
        };
        var Message = new Schema({
            partner: { type: String, "enum": ["venter", "listener", "system"] },
            text: { type: String },
            time: { type: Date, default: Date.now }
        });
        mongoose.model('Conversation', new Schema({
            serverSession: { type: String },
            status: { type: String, "enum": ["active", "complete"] },
            startTime: { type: Date, default: Date.now },
            finishTime: { type: Date, default: '01/01/0001' },
            finishReason: {
                type: String,
                "enum": [
                    "venterDisconnect", // the venter closed their browser tab or lost internet
                    "listenerDisconnect", // the venter closed their browser tab or lost internet
                    "venterRequest", // the venter requested a new partner
                    "listenerRequest", // the listener requested a new partner
                    "venterReportedAbuse", // venter reported abuse
                    "listenerReportedAbuse", // listener reported abuse
                    "serverRestart", // the Conversation was still "active" when the server restarted
                    "unknown"
                ],
                default: "unknown"
            },
            venter: ConversationPartner,
            listener: ConversationPartner,
            messages: [Message]
        }));
        mongoose.model('Abuser', new Schema({
            hashedIPAddress: { type: String },
            banned: { type: Boolean },
            referrers: [],
            conversations: []
        }));
    }());
    
    var Conversation = exports.Conversation = mongoose.model('Conversation');
    var Abuser = exports.Abuser = mongoose.model('Abuser');
    
    var saveConversation = function (conversation) {
        if (conversation.messages.length) {
            conversation.save(function (err) {
                if (err) {
                    log.error({
                        event: "Cannot save Conversation",
                        error: err.toString()
                    });
                }
            });
        }
    };
    
    setTimeout(function () {
        var serverSession = require("../app").sessionId;
        Conversation.find({ serverSession: { $ne: serverSession }, status: "active" }, function (err, conversations) {
            if (err) {
                log.error({
                    event: "Cannot retrieve inactive conversations",
                    error: err.toString()
                });
            } else {
                for (var i = 0, len = conversations.length; i < len; i += 1) {
                    var conversation = conversations[i];
                    conversation.status = "complete";
                    conversation.finishTime = Date.now();
                    conversation.finishReason = "serverRestart";
                    saveConversation(conversation);
                }
            }
        });
    }, 5000);
    
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
     * A hash of userId to requested partner public userId.
     */
    var queueRequestedPartners = createHash();
    
    /**
     * a simple hash of userId to roomId
     */
    var userIdToRoomId = createHash();
    /**
     * A hash of userId to other userIds that there has been an interaction with, to prevent talking to the same
     * person.
     */
    var userInteractions = createHash();
    
    var DEVELOPMENT = (process.env.NODE_ENV || "development") === "development";
    
    /**
     * Create a Room object
     *
     * @param {String} id The unique identifier of the room
     * @param {String} venterId The unique user ID for the venter that will be part of the room
     * @param {String} listenerId The unique user ID for the listener that will be part of the room
     */
    var Room = exports.Room = function (id, venterId, listenerId) {
        if (!(this instanceof Room)) {
            return new Room(id, venterId, listenerId);
        }
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
        
        var venter = User.getById(venterId);
        var listener = User.getById(listenerId);
        
        var venterIP = venter ? venter.getIPAddress() || "" : "";
        var listenerIP = listener ? listener.getIPAddress() || "" : "";
        
        var conversation = this.conversation = new Conversation({
            serverSession: require("../app").sessionId,
            status: "active",
            venter: {
                userId: venterId,
                hashedIPAddress: hashIPAddress(venterIP),
                geoLocation: {},
                userAgent: venter ? venter.userAgent || "" : ""
            },
            listener: {
                userId: listenerId,
                hashedIPAddress: hashIPAddress(listenerIP),
                geoLocation: {},
                userAgent: listener ? listener.userAgent || "" : ""
            },
            messages: []
        });
        saveConversation(conversation);
        
        if (venterIP && venterIP !== "127.0.0.1") {
            require('../app').geoipCity.lookup(venterIP, function (err, data) {
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
                saveConversation(conversation);
            });
        }
        
        if (listenerIP && listenerIP !== "127.0.0.1") {
            require('../app').geoipCity.lookup(listenerIP, function (err, data) {
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
                saveConversation(conversation);
            });
        }
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
     * @param {String} requestedPartnerId The public unique identifier of the requested partner. Optional.
     * @param {Boolean} priority Setting this flag to true pushes the user directly to the front of the queue.
     */
    Room.addUserToQueue = function (userId, type, requestedPartnerId, priority) {
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

        var user = User.getById(userId);
        if (DEVELOPMENT && (user.getIPAddress() == "" || user.getIPAddress() == "127.0.0.1")) {
            // console.log("setting ip for " + type + " " + userId);
            user.setIPAddress(type === "venter" ? "123.123.123.123" : "1.2.3.4");
        }

        var queue = type === "venter" ? venterQueue : listenerQueue;
        console.log( 'adding user ' + userId + ' to queue ' + type );

        if (priority) {
            console.log( 'prioritizing user ' + userId );

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
        delete queueRequestedPartners[userId];

        console.log( 'dropped user ' + userId + ' from queue' );
    };
    
    /**
     * Check the queues and create rooms if necessary
     */
    Room.checkQueues = function () {
        if (venterQueue.length === 0 || listenerQueue.length === 0) {
            // at least one is empty, nothing to do.
            console.log("venter or listener queue length == 0");
            console.log(venterQueue);
            console.log(listenerQueue);
            return;
        }
        
        var now = Date.now();
        
        for (var i = 0, lenI = venterQueue.length; i < lenI; i += 1) {
            var venterId = venterQueue[i];
            var venter = User.getById(venterId);

            if (venter && venter.isClientConnected()) {
                // venter exists and the client is still connected
                console.log("venter exists and the client is still connected");
                
                var venterRequestedPartner = queueRequestedPartners[venterId];
                if (venterRequestedPartner) {
                    if (venterRequestedPartner.timeout < now) {
                        delete queueRequestedPartners[venterId];
                        venterRequestedPartner = undefined;
                    }
                }
                
                for (var j = 0, lenJ = listenerQueue.length; j < lenJ; j += 1) {
                    var listenerId = listenerQueue[j];
                    var listener = User.getById(listenerId);
                    if (listener && listener.isClientConnected()) {
                        // listener exists and the client is still connected
                        
                        var listenerRequestedPartner = queueRequestedPartners[listenerId];
                        if (listenerRequestedPartner) {
                            if (listenerRequestedPartner.timeout < now) {
                                delete queueRequestedPartners[listenerId];
                                listenerRequestedPartner = undefined;
                            }
                        }
                        
                        if (!userInteractions[venterId] || userInteractions[venterId].indexOf(listenerId) === -1) {
                            console.log("the venter is new or has not talked with the listener before..");
                            // the venter is either new (and can be paired with anyone) or has not talked with the listener
                            // before
                            
                            if (venterRequestedPartner && User.getByPublicId(venterRequestedPartner.partnerId) !== listener) {
                                // the venter wants a partner, this is not the right listener.
                                console.log("The venter wants a partner, this is not the right listener.");
                                continue;
                            } else if (listenerRequestedPartner && User.getByPublicId(listenerRequestedPartner.partnerId) !== venter) {
                                // the listener wants a partner, this is not the right venter.
                                console.log("the listener wants a partner, this is not the right venter.");
                                continue;
                            }

                            var venterIP = venter.getIPAddress();
                            var listenerIP = listener.getIPAddress();

                            var hashedVenterIP = hashIPAddress(venterIP); 
                            var hashedListenerIP = hashIPAddress(listenerIP);
                            
                            console.log('About to enter abuser area');
//                            console.log('hashed ip', hashedIPAddress);
                            console.log('hashed venter', hashedVenterIP);
                            console.log('hashed listener', hashedListenerIP);
                            
                            
                            //TODO: refactor and remove this
                            Abuser.find({ hashedIPAddress: { $in: [hashedVenterIP, hashedListenerIP ]}, banned: true }, function (err, abusers) {
                                console.log('Callback has been called.');
                                if (err) {
                                    console.log('Error, cannot retrieve abuser by hashedIP');
                                    log.error({
                                        event: "Cannot retrieve abuser by hashedIP",
                                        error: err.toString()
                                    });
                                } else {
                                    var abuser = abusers.shift();
                                    if (abuser) {
                                        if (abuser.hashedIPAddress == hashedVenterIP) {
                                            console.log("creating room for venter abuser " + venterId + " and eliza " + venter.elizaUserId);
                                            new Room(guid(), venterId, venter.elizaUserId);
                                        } else  {
                                            console.log("creating room for listener abuser " + listenerId + " and eliza " + listener.elizaUserId);
                                            new Room(guid(), listener.elizaUserId, listenerId);
                                        }
                                    } else {
                                        console.log("creating standard room " + venterId + " " + listenerId);
                                        new Room(guid(), venterId, listenerId);
                                    }
                                }
                                console.log('About to check queues... - again');
                                return Room.checkQueues();
                            });
                            console.log('Check queues has returned.');
                            return;
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
    
    /**
     * Calculate the current queue position of the provided user.
     *
     * @param {String} userId the userId to check for its type.
     * @return {Number} The index in the queue. 0-based. If -1 is returned, not in a queue.
     */
    Room.getQueuePosition = function (userId) {
        var index = venterQueue.indexOf(userId);
        var queue;
        var otherQueue;
        if (index !== -1) {
            // venter
            queue = venterQueue;
            otherQueue = listenerQueue;
        } else {
            index = listenerQueue.indexOf(userId);
            if (index === -1) {
                return -1;
            }
            // listener
            queue = listenerQueue;
            otherQueue = venterQueue;
        }
        
        var result = index;
        for (var i = 0; i < index; i += 1) {
            var competitorId = queue[i];

            if (queueRequestedPartners[competitorId]) {
                // this person doesn't really count in the queue, they're waiting for someone
                index -= 1;
            } else {
                for (var j = 0, len = otherQueue.length; j < len; j += 1) {
                    var otherId = otherQueue[j];
                    
                    if (userInteractions[otherId] && userInteractions[otherId].indexOf(competitorId) !== -1 && userInteractions[otherId].indexOf(userId) === -1) {
                        // competitor can't queue with this person, already conversed with them, but the user we're
                        // checking has not yet, so they are potentially available, allowing the user to skip over this
                        // competitor.
                        index -= 1;
                        break;
                    }
                }
            }
        }
        if (index < 0) {
            index = 0;
        }
        
        return index;
    };
    
    /**
     * Delete the current room. Adds any current users to their appropriate queues.
     *
     * @param {String} type Either "listener" or "venter" for the person who left that ended the chat.
     * @param {String} reason Either "disconnect" or "request".
     */
    Room.prototype.delete = function (type, reason) {
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
        
        var conversation = this.conversation;
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
        saveConversation(conversation);
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
        this.numMessages += 1;
        for (var otherUserId in this.users) {
            if (otherUserId !== userId) {
                this.sendToUser(otherUserId, "msg", clientType, message);
            }
        }
        
        this.conversation.messages.push({
            partner: clientType,
            text: message
        });
        saveConversation(this.conversation);
        
        callback(true);
    };

    Room.prototype.sendTypeStatus = function (userId, message, callback) {
        this.poke();
        
        var clientType = this.users[userId];
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

        for (var otherUserId in this.users) {
            if (otherUserId !== userId) {
                this.sendToUser(otherUserId, "typing", clientType, message);
            }
        }
        
        callback(true);
    };
    
    Room.prototype.lookupUserGeoIP = function (userId, callback) {
        var user = User.getById(userId);
        if (!user || this.users[userId] !== "listener") {
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
        this.users[userId] = type;
        this.types[type] += 1;
        if (this.types[type] !== 1) {
            throw new Error("Expected this.types[" + JSON.stringify(type) + "] == 1, got " + this.types[type]);
        }

        var self = this;
        // let the new user know about the other users in the room.
        Object.keys(this.users).forEach(function (otherUserId) {
            if (otherUserId !== userId) {
                // let the old user know that the new one has joined
                self.lookupUserGeoIP(userId, function (geoInfo) {
                    var user = User.getById(userId);
                    self.sendToUser(otherUserId, "join", user && user.publicId, type, geoInfo);
                });
                var otherClientType = self.users[otherUserId];
                if (VALID_TYPES[otherClientType]) {
                    // let the new user know about the existing old users
                    self.lookupUserGeoIP(otherUserId, function (geoInfo) {
                        var otherUser = User.getById(otherUserId);
                        self.sendToUser(userId, "join", otherUser && otherUser.publicId, otherClientType, geoInfo);
                    });
                }

                // if (User.getById(userId).elizaUserId && User.getById(otherUserId).elizaUserId) {
                (userInteractions[userId] || (userInteractions[userId] = [])).push(otherUserId);
                (userInteractions[otherUserId] || (userInteractions[otherUserId] = [])).push(userId);
                // }
            }
        });
        
        Room.removeUserFromQueue(userId);
    };
    
    /**
     * Report abuse move the provided user from the Room.
     *
     * @param {String} userId The unique identifer of the user that reports abuse.
     */
    Room.prototype.reportAbuse = function (userId) {
        var self = this;
        var clientType = this.users[userId];
        if (clientType) {
            log.info({
                event: "Abuse Reported",
                user: userId,
                room: this.id,
                type: clientType || 'unknown'
            });
        }

        Object.keys(this.users).forEach(function (otherUserId) {
            if (otherUserId !== userId) {
                var user = User.getById(userId);
                var otherUser = User.getById(otherUserId);

                var abuserType = self.users[otherUserId];
                var hashedIPAddress = self.conversation[abuserType].hashedIPAddress;
                Abuser.find({ hashedIPAddress: self.conversation[abuserType].hashedIPAddress }, function (err, abusers) {
                    if (err) {
                        log.error({
                            event: "Cannot retrieve inactive conversations",
                            error: err.toString()
                        });
                    } else {
                        var abuser = abusers[0];
                        if (abuser) {
                            abuser.conversations.push(self.conversation._id);
                            abuser.referrers.push(otherUser.referrer);
                        } else {
                            abuser = new Abuser({
                                hashedIPAddress: self.conversation[abuserType].hashedIPAddress,
                                conversations: [ self.conversation._id ],
                                referrers: [ otherUser.referrer ]
                            });
                        }
                        abuser.save();
                    }
                });
                /* this creates object with "$push" key, eg { "$push": {collections : .. }}, probably bug in mongoose 
                Abuser.update(
                    { hashedIPAddress: self.conversation[abuserType].hashedIPAddress },
                    { $push: { conversations: [ self.conversation._id ] } },
                    { upsert: true },
                    function (err) {
                        if (err) {
                            log.error({
                                event: "Cannot update abuser",
                                error: err.toString()
                            });
                            console.log(err.toString())
                        }
                    }
                ); */
            }
        });
    }

    /**
     * Remove the provided user from the Room.
     *
     * @param {String} userId The unique identifer of the user to remove.
     * @param {String} reason Either "request" or "disconnect"
     */
    Room.prototype.removeUser = function (userId, reason) {
        var self = this;

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
                if (this.types[clientType] !== 0) {
                    throw new Error("Expected this.types[" + JSON.stringify(clientType) + "] == 0, got " + this.types[clientType]);
                }
            }
        }
        
        var users = this.users;
        delete users[userId];
        delete userIdToRoomId[userId];

        if ( this.hasAnyUsers() ) {
            console.log( 'trashing room %s due to user disconnect', this.id );

            var userIds = Object.keys( users );

            async.forEach(
                userIds,
                function( user, callback ) {
                    if ( reason == 'disconnect' ) {
                        console.log( 'dropping user %s from room', user );

                        delete users[ user ]
                        delete userIdToRoomId[ user ];

                        console.log( 'sending partDisconnect message to %s', user );

                        self.sendToUser( user, 'partDisconnect', clientType || 'unknown' );
                    } else {
                        // send partRequest and automatically find a new match
                        console.log( 'sending partRequest message to %s', user );

                        self.sendToUser( user, 'partRequest', clientType || 'unknown' );

                    }

                    callback();
                },
                function( err ) {
                    var remaining = Object.keys( users );

                    console.log( '%s room deconstruction complete, users remaining: %s', reason, remaining.join( ', ' ) );

                    self.delete( clientType || 'unknown', reason );
                }
            );
        } else {
            // no users to worry about, just delete the room
            this.delete( clientType || 'unknown', reason );
        }
    };
}());
