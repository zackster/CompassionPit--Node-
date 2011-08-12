/*jshint devel: true */
/*global setInterval: false */

(function () {
    "use strict";
    
    var express = require("express");
    
    var app = module.exports = express.createServer(),
        sys = require("sys"),
        socketIO = require("socket.io"),
        connect = require("connect"),
        Room = require("./rooms/models").Room,
        User = require("./users/models").User,
        guid = require("./utils").guid,
        forceLatency = require("./utils").forceLatency,
        latencyWrap = require("./utils").latencyWrap,
        config = require("./config"),
        log = require("./log"),
        mergeStatic = require("./mergeStatic"),
        geoip = require("geoip");
    
    app.sessionId = guid();
    app.geoipCity = new geoip.City(__dirname + '/GeoLiteCity.dat');
    
    app.dynamicHelpers({
        base: function () {
            // return the app's mount-point
            // so that urls can adjust. For example
            // if you run this example /post/add works
            // however if you run the mounting example
            // it adjusts to /blog/post/add
            return '/' === app.route ? '' : app.route;
        }
    });
    
    app.helpers({
        config: config
    });
    
    app.configure(function () {
        app.use(express.static(__dirname + '/static'));
        app.use(express.bodyParser());
        app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    });
    
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    
    var socket;
    
    var getRoomCounts = function () {
        var result = Room.calculateCounts();
        
        return {l: result[0], v: result[1]};
    };
    
    app.get("/", function (req, res, next) {
        res.render('index', {
            roomCounts: getRoomCounts()
        });
    });
    
    app.get("/index.html", function (req, res) {
        res.redirect("/", 301);
    });
    
    app.get("/about-us", function (req, res) {
        res.render('about-us');
    });
    
    app.get("/about-us.html", function (req, res) {
        res.redirect("/about-us", 301);
    });
    
    app.get("/privacy-policy", function (req, res) {
        res.render('privacy-policy');
    });
    
    app.get("/privacypolicy.html", function (req, res) {
        res.redirect("/privacy-policy", 301);
    });
    
    app.get("/terms-of-service", function (req, res) {
        res.render('terms-of-service');
    });
    
    app.get("/tos.html", function (req, res) {
        res.redirect("/terms-of-service", 301);
    });
    
    app.get("/vent", function (req, res) {
        res.render("chat", {
            type: "venter"
        });
    });
    
    app.get("/listen", function (req, res) {
        res.render("chat", {
            type: "listener"
        });
    });

    app.get("/chat.html", function (req, res) {
        if (req.query) {
            switch (req.query.type) {
            case "venter":
                res.redirect("/vent", 301);
                return;
            case "listener":
                res.redirect("/listen", 301);
                return;
            }
        }
        res.redirect("/", 301);
    });
    
    app.get("/system", function (req, res) {
        res.render("system");
    });
    
    app.post("/system", function (req, res) {
        if (req.body.password !== config.systemPassword) {
            res.send("Wrong password");
        } else if (!req.body.message) {
            res.send("No message provided");
        } else if (req.body.restart && isNaN(parseInt(req.body.restartTime, 10))) {
            res.send("Bad restart time specified");
        } else {
            var message = req.body.message;
            forceLatency(function () {
                socket.sockets.json.send({
                    t: "sysmsg",
                    d: message
                });
            });
            if (req.body.restart) {
                setTimeout(function () {
                    require('child_process').spawn('forever', ['restart', "app.js"]);
                }, parseInt(req.body.restartTime, 10) * 1000);
            }
            res.send("Successfully sent " + JSON.stringify(message));
        }
    });
    
    app.get('/messageChart', function (req, res) {
        log.LogEntry.find({}, null, { sort: { time: 1 } }, function (err, docs) {
            var messages = [];
            docs.forEach(function (doc) {
                if (doc.action === "messageSent") {
                    var count = doc.count || 1;
                    for (var i = 0; i < count; i += 1) {
                        messages.push(+new Date(doc.time));
                    }
                }
            });
            res.render('messageChart', {
                messages: messages
            });
        });
    });
    
    // import in the room-based actions
    require("./rooms/actions")(app);
    
    // add the log-based actions
    log.addActions(app);
    
    process.on('uncaughtException', function (err) {
        console.error(JSON.stringify(err));
        log.error({
            event: "Uncaught exception",
            error: String(err.message),
            stack: String(err.stack)
        });
    });
    
    if (!config.serveMerged) {
        mergeStatic = function (callback) {
            callback("", "");
        };
    }
    
    mergeStatic(function (jsHash, cssHash) {
        app.helpers({
            jsHash: jsHash,
            cssHash: cssHash
        });
        
        require('sys').puts("Server started on port " + config.port);
        app.listen(config.port);
    
        // let socket.io hook into the existing app
        socket = app.socket = socketIO.listen(app);

        // disable debug logging in socket.io
        socket.set( 'log level', 1 );
    
        var socketHandlers = Object.create(null);
        
        socket.configure(function () {
            socket.set('authorization', function (handshakeData, callback) {
                var headers = handshakeData.headers;
                if (headers) {
                    var ipAddress = headers['x-forwarded-for'];
                    if (ipAddress) {
                        handshakeData.address.address = ipAddress;
                    }
                }
                callback(null, true);
            });
            
            socket.sockets.on('connection', function (client) {
                client.on('message', latencyWrap(function (data) {
                    var type = data.t;
                    if (type) {
                        var handler = socketHandlers[type];
                        if (handler) {
                            var user = User.getBySocketIOId(client.id);
                            if (type !== "register" && !user) {
                                console.log("Received message from unregistered user: " + client.id + ": " + JSON.stringify(data));
                            } else {
                                if (user && data.i && user.lastReceivedMessageIndex < data.i) {
                                    user.lastReceivedMessageIndex = data.i;
                                }
                                handler(client, user, data.d, function (result) {
                                    var message;
                                    if (type === "register") {
                                        message = {t: "register"};
                                    } else {
                                        message = {i: data.i};
                                    }
                                    if (result !== null && result !== undefined) {
                                        message.d = result;
                                    }
                                    if (type !== "register") {
                                        user.send(message);
                                    } else {
                                        forceLatency(function () {
                                            client.json.send(message);
                                        });
                                    }
                                });
                            }
                        } else {
                            console.log("Received message with unknown handler: " + data.t);
                        }
                    } else {
                        console.log("Received improper message", JSON.stringify(data));
                    }
                }));

                // on disconnect, we want to clean up the user and inform the room they are in of the disconnect
                client.on('disconnect', latencyWrap(function () {
                    var clientId = client.id;

                    var user = User.getBySocketIOId(clientId);
                    log.info({
                        event: "Disconnected",
                        client: clientId,
                        user: user ? user.id : null
                    });
                    if (user) {
                        user.setSocketIOId(null);
                    }
                    Room.checkQueues();
                }));

                log.info({
                    event: "Connected",
                    client: client.id
                });
            });
            setInterval(function () {
                User.cleanup();
                Room.checkQueues();
            }, 5000);
        });
        
        /**
         * Register the client with the server
         */
        socketHandlers.register = function (client, _, data, callback) {
            if (!data) {
                data = {};
            }
            var userId = data.u || null,
                publicUserId = data.p || null,
                lastMessageReceived = data.n || 0,
                userAgent = data.a || null;
            var clientId = client.id;
            
            var user = userId && User.getById(userId);
            var isNewUser = !user;
            if (isNewUser) {
                if (userId && publicUserId) {
                    user = new User(clientId, userId, publicUserId);
                } else {
                    user = new User(clientId);
                }
                user.getIPAddress();
                user.userAgent = userAgent || "";
                user.disconnect(function () {
                    var room = Room.getByUserId(user.id);
                    if (room) {
                        room.removeUser(user.id, "disconnect");
                    } else {
                        Room.removeUserFromQueue(user.id);
                    }
                    log.info({
                        event: "Delete user",
                        user: user.id
                    });
                });
                log.info({
                    event: "New user",
                    client: clientId,
                    user: user.id
                });
                user.setSocketIOId(client.id, lastMessageReceived);
            } else {
                user.setSocketIOId(client.id, lastMessageReceived);
                log.info({
                    event: "Reconnected",
                    client: clientId,
                    user: user.id
                });
            }
            
            callback([config.version, isNewUser, user.id, user.publicId, user.lastReceivedMessageIndex]);
            Room.checkQueues();
        };
        
        /**
         * Request the current position the client is in the queue for
         */
        socketHandlers.queue = function (client, user, _, callback) {
            callback(Room.getQueuePosition(user.id));
        };
    
        /**
         * Request to join a channel based on the provided type
         */
        socketHandlers.join = function (client, user, data, callback) {
            var type = data.type;
            if (type !== "venter") {
                type = "listener";
            }

            var userId = user.id;
            
            var room = Room.getByUserId(userId);
            if (room) {
                room.removeUser(userId, "request");
            }
            Room.addUserToQueue(userId, data.type, data.partnerId, data.priority);
        
            callback(true);
        };
    
        /**
         * Send a chat message to the room the client is current in.
         */
        socketHandlers.msg = function (client, user, message, callback) {
            var userId = user.id;
            
            var room = Room.getByUserId(userId);
            if (!room) {
                callback(false);
                return;
            }
            log.store("messageSent");
            room.receiveMessage(userId, message, callback);
        };

        /**
         * typing status.
         */
        socketHandlers.typing = function (client, user, message, callback) {
            var userId = user.id;
            
            var room = Room.getByUserId(userId);
            if (!room) {
                callback(false);
                return;
            }
            room.sendTypeStatus(userId, message, callback);
        };
    
        /**
         * Send a "ping" to let the server know the client is still active
         */
        socketHandlers.ping = function (client, user, _, callback) {
            var userId = user.id;

            var room = Room.getByUserId(userId);
            if (room) {
                room.poke(userId);
            }

            if (callback) {
                callback("pong");
            }
        };
        
        socketHandlers.counts = function (client, user, _, callback) {
            callback(getRoomCounts());
        };
    });
}());
