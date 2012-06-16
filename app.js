/*jshint devel: true */
/*global setInterval: false */
//just for debugging -- looking for errors that would trigger disconnects, and any other problems
//todo - modify log.js to insert this into the database .


var util = require("util");

process.on('uncaughtException',
function(err) {
    util.puts("We found an uncaught exception.");
    util.puts(err);
    util.puts(err.stack);
});

 (function() {
    "use strict";

    var express = require("express");
    require("./database/singleton");


    var app = module.exports = express.createServer(),
    util = require("util"),
    _ = require('underscore'),
    socketIO = require("socket.io"),
    Room = require("./rooms/models").Room,
    User = require("./users/models").User,
    guid = require("./utils").guid,
    forceLatency = require("./utils").forceLatency,
    latencyWrap = require("./utils").latencyWrap,
    config = require("./config"),
    log = require("./log"),
    mergeStatic = require("./mergeStatic"),
    geoip = require("geoip"),
    vB_dao = require("./vBDao"),
    authServer = require('./authentication/auth-server').authServer(),
    feedbackServer = require('./feedback/feedback-server').feedbackServer();

    var getRoomCounts = function() {
        var result = Room.calculateCounts();
        global.room_counts = {
            l: result[0],
            v: result[1]
        };
    };
    global.room_counts = {
        l: 0,
        v: 0
    };
    setInterval(getRoomCounts,120*1000);

    var bad_ips = [];

    var registerAppRoutes = function(app) {
        app.sessionId = guid();
        app.geoipCity = new geoip.City(__dirname + '/GeoLiteCity.dat');

        app.dynamicHelpers({
            base: function() {
                return '/' === app.route ? '': app.route;
            }
        });

        app.helpers({
            config: config
        });

        app.configure(function() {
            app.use(express['static'](__dirname + '/static'));
            app.use(express.bodyParser());
            app.use(express.cookieParser());
            app.use(express.errorHandler({
                dumpExceptions: true,
                showStack: true
            }));
        });

        app.set('views', __dirname + '/views');
        app.set('view engine', 'jade');

        app.get("/",
        function(req, res, next) {
            var opts = {
                loggedOut: false,
                roomCounts: global.room_counts
            };
            if (req.query && req.query.logout === 'true') {
                opts.loggedOut = true;
            }
            res.render('index', opts);
        });

        app.get("/counts",
        function(req, res) {
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(global.room_counts));
        });

        app.get("/index.html",
        function(req, res) {
            res.redirect("/", 301);
        });

        app.get("/about-us",
        function(req, res) {
            res.render('about-us');
        });

        app.get("/about-us.html",
        function(req, res) {
            res.redirect("/about-us", 301);
        });

        app.get("/contact",
        function(req, res) {
            res.render('contact');
        });

        app.get("/faq",
        function(req, res) {
            res.render('faq');
        });

    app.get("/listener-training",
    function(req, res) {
        res.render('listener-training');
    });

        app.get("/privacy-policy",
        function(req, res) {
            res.render('privacy-policy');
        });

        app.get("/privacypolicy.html",
        function(req, res) {
            res.redirect("/privacy-policy", 301);
        });

        app.get("/terms-of-service",
        function(req, res) {
            res.render('terms-of-service');
        });

        app.get("/tos.html",
        function(req, res) {
            res.redirect("/terms-of-service", 301);
        });

        app.get("/vent",
        function(req, res) {
            res.render("chat", {
                type: "venter"
            });
        });
		
		global.ip2req=[];
        app.get("/listen",
        function(req, res) {
            if ((process.env.NODE_ENV || "development") === 'development') {
                res.render("chat", {
                    type: "listener"
                });
            }
            else {
                // console.log("new listener: " + (req.headers['x-forwarded-for'] || req.address.address));
                authServer.checkLogin(req,
                function(username) {
                    // console.log('check login called back with username ' + username);
                    if (username) {
						global.ip2req[(req.headers['x-forwarded-for'] || req.address.address)] = req;
                        vB_dao.getEmailAndJoindateForUser(username, function(vB_info) {
                            res.render("chat", {
                                type: "listener",
                                email: vB_info.email,
                                created_at: vB_info.created_at,
                                username: username
                            });
                        });
                    }
                    else {
                        var ip_addr = req.headers['x-forwarded-for'] || req.address.address;
                        if(_.indexOf(bad_ips,ip_addr) === -1) {
                            res.render("chat", {
                                    type: "listener"
                            });
                        }
                        else {
                                res.render("listener-registration");
                        }
                    }
               });
           }
        });

        app.get("/chat.html",
        function(req, res) {
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

        app.get("/system",
        function(req, res) {
            res.render("system");
        });

        app.post("/system",
        function(req, res) {
            if (req.body.password !== config.systemPassword) {
                res.send("Wrong password");
            } else if (!req.body.message) {
                res.send("No message provided");
            } else if (req.body.restart && isNaN(parseInt(req.body.restartTime, 10))) {
                res.send("Bad restart time specified");
            } else {
                var message = req.body.message;
                forceLatency(function() {
                    socketIO.sockets.json.send({
                        t: "sysmsg",
                        d: message
                    });
                });
                if (req.body.restart) {
                    setTimeout(function() {
                        require('child_process').spawn('forever', ['restart', "app.js"]);
                    },
                    parseInt(req.body.restartTime, 10) * 1000);
                }
                res.send("Successfully sent " + JSON.stringify(message));
            }
        });


        // import in the room-based actions
        require("./rooms/actions")(app);

        // add the log-based actions
        log.addActions(app);

    };

    function registerSocketIO(app) {
        // let socket.io hook into the existing app
        var socket;
        socket = app.socket = socketIO.listen(app);

        // disable debug logging in socket.io
        socket.set('log level', 1);

        var socketHandlers = Object.create(null);

        socket.configure(function() {

            socket.set('authorization',
            function(handshakeData, callback) {
                var headers = handshakeData.headers;
                if (headers) {
                    var ipAddress = headers['x-forwarded-for'];
                    if (ipAddress) {
                        handshakeData.address.address = ipAddress;
                    }
                }
                callback(null, true);
            });

            socket.sockets.on('connection',
            function(client) {

                client.on('message', latencyWrap(function(data) {
                    var type = data.t;
                    if (type) {
                        var handler = socketHandlers[type];
                        if (handler) {
                            var user = User.getBySocketIOId(client.id);
                            if (type !== "register" && !user) {
                                // console.log("Received message from unregistered user: " + client.id + ": " + JSON.stringify(data));
                            } else {
                                if (user && data.i && user.lastReceivedMessageIndex < data.i) {
                                    user.lastReceivedMessageIndex = data.i;
                                }
                                handler(client, user, data.d,
                                function(result) {

                                    var message;
                                    if (type === "register") {
                                        message = {
                                            t: "register"
                                        };
                                    } else {
                                        message = {
                                            i: data.i
                                        };
                                    }

                                    // message.d is the variable callback passed in from the handler, and will get applied client-side by comm.js
                                    if (result !== null && result !== undefined) {
                                        message.d = result;
                                    }
                                    if (type !== "register") {
                                        user.send(message);
                                    } else {
                                        forceLatency(function() {
                                            client.json.send(message);
                                        });
                                    }
                                    // console.log("Message: %s\nResult: %s\nUser: %s\nType: %s\nClient: %s\n\n", message, result, user, type, client);
                                });
                            }
                        } else {
                            throw new Error("Received message with unknown handler: " + data.t);
                        }
                    } else {
                        throw new Error("Received improper message", JSON.stringify(data));
                    }
                }));

                // on disconnect, we want to clean up the user and inform the room they are in of the disconnect
                client.on('disconnect', latencyWrap(function() {
                    var clientId = client.id;

                    var user = User.getBySocketIOId(clientId),
                    uid = user ? user.id: null;
                    log.store("disconnect", client.id);
                    log.info({
                        event: "Disconnected",
                        client: clientId,
                        user: uid
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
                log.store("connect", client.id);
            });
            setInterval(function() {
                User.cleanup();
                Room.checkQueues();
            },
            5000);
        });

        /**
      * Register the client with the server
      * Second parameter is "_" because user is not yet defined
      */
        socketHandlers.register = function(client, _, data, callback) {
            if (!data) {
                data = {};
            }
            var userId = data.u || null,
            publicUserId = data.p || null,
            lastMessageReceived = data.n || 0,
            userAgent = data.a || null,
            referrer = data.r || null;


            var clientId = client.id;



            var user = userId && User.getById(userId);
            var isNewUser = !user;
            if (isNewUser) {
                if (userId && publicUserId) {
                    user = new User(clientId, userId, publicUserId);
                } else {
                    user = new User(clientId, null, null);
                }
                user.getIPAddress();
                user.referrer = referrer || "";
                user.userAgent = userAgent || "";
                user.disconnect(function() {
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
                user.setSocketIOId(client.id, lastMessageReceived);
            } else {
                user.setSocketIOId(client.id, lastMessageReceived);
                log.info({
                    event: "Reconnected",
                    client: clientId,
                    user: user.id
                });
            }

            if ((process.env.NODE_ENV || "development") === 'development') {
                callback([config.version, isNewUser, user.id, user.publicId, user.lastReceivedMessageIndex, 'Zachary Burt']);
				user.setForumsId('Zachary Burt');
            }
            else {
                var req = client.manager.handshaken[clientId.toString()];
                if (req.headers && req.headers.cookie) {
                    req.cookies = require('connect').utils.parseCookie(req.headers.cookie);
                    authServer.checkLogin(req,
                    function(username) {
                        if (username !== false) {
                            authServer.logged_in_users[user.id] = username;
							user.setForumsId(username);
                            callback([config.version, isNewUser, user.id, user.publicId, user.lastReceivedMessageIndex, username]);
                        }
                        else {
                            callback([config.version, isNewUser, user.id, user.publicId, user.lastReceivedMessageIndex, false]);
                        }

                    });
                }
                else {

                    authServer.checkLogin(global.ip2req[user.getIPAddress()],
                    function(username) {
						// console.log("Check login returned with value: %s", username);
                        if (username !== false) {
                            authServer.logged_in_users[user.id] = username;
                            // console.log('checkLogin called back with username: ', username);
							user.setForumsId(username);
							callback([config.version, isNewUser, user.id, user.publicId, user.lastReceivedMessageIndex, username]);
		                    
						}
						else {
							callback([config.version, isNewUser, user.id, user.publicId, user.lastReceivedMessageIndex, false]);		                    
						}
					});



                }

            }

            Room.checkQueues();
        };

		socketHandlers.encourageTwitterFollow = function(client, user, data, callback) {		
		    var listenerId = user.id,
            room = Room.getByUserId(listenerId);
            if (!room) {
                return;
            }
            var venterId = room.conversation.venter.userId;
            room.sendToUser(venterId, "twitter-encouragement", data.twitter_username);            
		};		
		
		
		socketHandlers.showUsername = function(client, user, data, callback) {		
			// console.log("USER NAME IS: %s", user.forums_id);
		    var listenerId = user.id,
            room = Room.getByUserId(listenerId);
            if (!room) {
                return;
            }
            var venterId = room.conversation.venter.userId;
			// console.log('user', user);
            room.sendToUser(venterId, "forum-username", user.forums_id);            
		};
		socketHandlers.hideUsername = function(client, user, data, callback) {		
		    var listenerId = user.id,
            room = Room.getByUserId(listenerId);
            if (!room) {
                return;
            }
            var venterId = room.conversation.venter.userId;
            room.sendToUser(venterId, "forum-username", false);            
		};			

        /**
      * Request the current position the client is in the queue for
      */
        socketHandlers.queue = function(client, user, _, callback) {

            var queue_info = Room.getQueuePosition(user.id);
            log.logWaitTime({
                userid: user.id,
                user_type: queue_info.user_type,
                queuePosition: queue_info.queue_position,
                join_time: user.join_time,
                current_time: new Date().getTime()
            });

            callback(queue_info.queue_position);
        };

        socketHandlers.authenticateUser = function(client, user, data, callback) {
            authServer.login(user.id, data.username, data.password,
            function(success) {
                if (success) {
                    feedbackServer.creditFeedback({
                        id: user.id,
                        username: data.username
                    });
                    callback(true);
                }
                else {
                    callback(false);
                }
            });
        };

        socketHandlers.updateHUD = function(client, user, data, callback) {


            // var listenerId = user.id;
            // 
            // feedbackServer.getLeaderboardForUser(listenerId,
            // function(info) {
            //     callback(info);
            // });

            return;
        };

        socketHandlers.listenerFeedback = function(client, user, data, callback) {

            var venterId = user.id,
            room = Room.getByUserId(venterId);
            if (!room) {
                return;
            }
            var listenerId = room.conversation.listener.userId;

            // console.log('Adding feedback...');
            feedbackServer.addFeedback({
                venter: venterId,
                listener: listenerId,
                direction: data.direction
            });
            // 
            // console.log('Sending acknowledgement....');
            // console.log('sending to: ', listenerId);
            room.sendToUser(listenerId, "received-feedback", data.direction);
        };

        socketHandlers.getPreviousPartner = function(client, user, data, callback) {
            var previous_partners = User.getById(user.id).partner_list;
            callback(authServer.getUsernameFromListenerId(previous_partners[previous_partners.length()-2]));
        };

        /**
      * Request to join a channel based on the provided type
      */
        socketHandlers.join = function(client, user, data, callback) {
            var type = data.type;
            if (type !== "venter") {
                type = "listener";
            }

            var userId = user.id;

            var room = Room.getByUserId(userId);
            if (room) {
                room.removeUser(userId, "request");
            }
            // console.log("adding user to queue");
            // console.log(userId, data.type, data.partnerId, data.priority);
            Room.addUserToQueue(userId, data.type, data.partnerId, data.priority);
            callback(true);
        };

        /**
      * Send a chat message to the room the client is current in.
      */
        socketHandlers.msg = function(client, user, message, callback) {
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
        socketHandlers.typing = function(client, user, message, callback) {
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
        socketHandlers.ping = function(client, user, _, callback) {
            var userId = user.id;

            var room = Room.getByUserId(userId);
            if (room) {
                room.poke(userId);
            }

            if (callback) {
                callback("pong");
            }
        };

        socketHandlers.counts = function(client, user, _, callback) {
            callback(global.room_counts);
        };

    }

    if (!config.serveMerged) {
        mergeStatic = function(callback) {
            callback("", "");
        };
    }

    mergeStatic(function(jsHash, cssHash) {

        app.helpers({
            jsHash: jsHash,
            cssHash: cssHash
        });

        util.puts("Registering app routes");
        registerAppRoutes(app);
        util.puts("Registering Socket.IO");
        registerSocketIO(app);

        app.listen(config.port);
        util.puts("Server started on port " + config.port);

    // REFACTOR this to fire once the MongoDB connection connects
        function bip_callback(bad_ips) {
            global.bad_ips = bad_ips;
        }
        setTimeout(feedbackServer.getNegativeIPs(bip_callback),10000);


        getRoomCounts();

    });

}());
