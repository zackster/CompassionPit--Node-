(function() {
  var util, _;

  util = require("util");

  _ = require("underscore");

  process.on("uncaughtException", function(err) {
    util.puts("We found an uncaught exception.");
    util.puts(err);
    return util.puts(err.stack);
  });

  (function() {
    var Room, User, app, authServer, config, express, feedbackServer, forceLatency, geoip, getRoomCounts, guid, latencyWrap, log, mergeStatic, registerAppRoutes, registerSocketIO, socketIO, vB_dao;
    registerSocketIO = function(app) {
      var socket, socketHandlers;
      socket = void 0;
      socket = app.socket = socketIO.listen(app);
      socket.set("log level", 1);
      socketHandlers = {};
      socket.configure(function() {
        socket.set("authorization", function(handshakeData, callback) {
          var headers, ipAddress;
          headers = handshakeData.headers;
          if (headers) {
            ipAddress = headers["x-forwarded-for"];
            if (ipAddress) handshakeData.address.address = ipAddress;
          }
          return callback(null, true);
        });
        socket.sockets.on("connection", function(client) {
          client.on("message", latencyWrap(function(data) {
            var handler, type, user;
            type = data.t;
            if (type) {
              handler = socketHandlers[type];
              if (handler) {
                user = User.getBySocketIOId(client.id);
                if (type !== "register" && !user) {
                  return console.log("Received message from unregistered user: " + client.id + ": " + JSON.stringify(data));
                } else {
                  if (user && data.i && user.lastReceivedMessageIndex < data.i) {
                    user.lastReceivedMessageIndex = data.i;
                  }
                  return handler(client, user, data.d, function(result) {
                    var message;
                    message = void 0;
                    if (type === "register") {
                      message = {
                        t: "register"
                      };
                    } else {
                      message = {
                        i: data.i
                      };
                    }
                    if (result !== null && result !== undefined) {
                      message.d = result;
                    }
                    if (type !== "register") {
                      return user.send(message);
                    } else {
                      return forceLatency(function() {
                        return client.json.send(message);
                      });
                    }
                  });
                }
              } else {
                throw new Error("Received message with unknown handler: " + data.t);
              }
            } else {
              throw new Error("Received improper message", JSON.stringify(data));
            }
          }));
          client.on("disconnect", latencyWrap(function() {
            var clientId, uid, user;
            clientId = client.id;
            user = User.getBySocketIOId(clientId);
            uid = (user ? user.id : null);
            log.store("disconnect", client.id);
            log.info({
              event: "Disconnected",
              client: clientId,
              user: uid
            });
            if (user) user.setSocketIOId(null);
            return Room.checkQueues();
          }));
          log.info({
            event: "Connected",
            client: client.id
          });
          return log.store("connect", client.id);
        });
        return setInterval((function() {
          User.cleanup();
          return Room.checkQueues();
        }), 5000);
      });
      return _.extend(socketHandlers, {
        register: function(client, _, data, callback) {
          var clientId, isNewUser, lastMessageReceived, publicUserId, referrer, req, user, userAgent, userId;
          if (!data) data = {};
          userId = data.u || null;
          publicUserId = data.p || null;
          lastMessageReceived = data.n || 0;
          userAgent = data.a || null;
          referrer = data.r || null;
          clientId = client.id;
          user = userId && User.getById(userId);
          isNewUser = !user;
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
              var room;
              room = Room.getByUserId(user.id);
              if (room) {
                room.removeUser(user.id, "disconnect");
              } else {
                Room.removeUserFromQueue(user.id);
              }
              return log.info({
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
          if ((process.env.NODE_ENV || "development") === "development") {
            callback([config.version, isNewUser, user.id, user.publicId, user.lastReceivedMessageIndex, "Zachary Burt"]);
          } else {
            req = client.manager.handshaken[clientId.toString()];
            if (req.headers && req.headers.cookie) {
              req.cookies = require("connect").utils.parseCookie(req.headers.cookie);
              authServer.checkLogin(req, function(username) {
                if (username !== false) {
                  authServer.logged_in_users[user.id] = username;
                  return callback([config.version, isNewUser, user.id, user.publicId, user.lastReceivedMessageIndex, username]);
                } else {
                  return callback([config.version, isNewUser, user.id, user.publicId, user.lastReceivedMessageIndex, false]);
                }
              });
            } else {
              callback([config.version, isNewUser, user.id, user.publicId, user.lastReceivedMessageIndex, false]);
            }
          }
          return Room.checkQueues();
        },
        queue: function(client, user, _, callback) {
          var queue_info;
          queue_info = Room.getQueuePosition(user.id);
          log.logWaitTime({
            userid: user.id,
            user_type: queue_info.user_type,
            queuePosition: queue_info.queue_position,
            join_time: user.join_time,
            current_time: new Date().getTime()
          });
          return callback(queue_info.queue_position);
        },
        authenticateUser: function(client, user, data, callback) {
          return authServer.login(user.id, data.username, data.password, function(success) {
            if (success) {
              feedbackServer.creditFeedback({
                id: user.id,
                username: data.username
              });
              return callback(true);
            } else {
              return callback(false);
            }
          });
        },
        updateHUD: function(client, user, data, callback) {
          var listenerId;
          listenerId = user.id;
          feedbackServer.getLeaderboardForUser(listenerId, function(info) {
            return callback(info);
          });
        },
        listenerFeedback: function(client, user, data, callback) {
          var listenerId, room, venterId;
          venterId = user.id;
          room = Room.getByUserId(venterId);
          if (!room) return;
          listenerId = room.conversation.listener.userId;
          console.log("Adding feedback...");
          feedbackServer.addFeedback({
            venter: venterId,
            listener: listenerId,
            direction: data.direction
          });
          console.log("Sending acknowledgement....");
          console.log("sending to: ", listenerId);
          return room.sendToUser(listenerId, "received-feedback", data.direction);
        },
        getPreviousPartner: function(client, user, data, callback) {
          var previous_partners;
          previous_partners = User.getById(user.id).partner_list;
          return callback(authServer.getUsernameFromListenerId(previous_partners[previous_partners.length() - 2]));
        },
        join: function(client, user, data, callback) {
          var room, type, userId;
          type = data.type;
          if (type !== "venter") type = "listener";
          userId = user.id;
          room = Room.getByUserId(userId);
          if (room) room.removeUser(userId, "request");
          Room.addUserToQueue(userId, data.type, data.partnerId, data.priority);
          return callback(true);
        },
        msg: function(client, user, message, callback) {
          var room, userId;
          userId = user.id;
          room = Room.getByUserId(userId);
          if (!room) {
            callback(false);
            return;
          }
          log.store("messageSent");
          return room.receiveMessage(userId, message, callback);
        },
        typing: function(client, user, message, callback) {
          var room, userId;
          userId = user.id;
          room = Room.getByUserId(userId);
          if (!room) {
            callback(false);
            return;
          }
          return room.sendTypeStatus(userId, message, callback);
        },
        ping: function(client, user, _, callback) {
          var room, userId;
          userId = user.id;
          room = Room.getByUserId(userId);
          if (room) room.poke(userId);
          if (callback) return callback("pong");
        },
        counts: function(client, user, _, callback) {
          return callback(getRoomCounts());
        }
      });
    };
    "use strict";
    require("./database/singleton");
    express = require("express");
    app = module.exports = express.createServer();
    util = require("util");
    socketIO = require("socket.io");
    Room = require("./rooms/models").Room;
    User = require("./users/models").User;
    guid = require("./lib/utils").guid;
    forceLatency = require("./lib/utils").forceLatency;
    latencyWrap = require("./lib/utils").latencyWrap;
    config = require("./config");
    log = require("./log");
    mergeStatic = require("./lib/merge_static");
    geoip = require("geoip");
    vB_dao = require("./lib/vbdao");
    authServer = require("./authentication/auth_server").authServer();
    feedbackServer = require("./feedback/feedback_server").feedbackServer();
    getRoomCounts = function() {
      var counts, result;
      result = Room.calculateCounts();
      return counts = {
        l: result[0],
        v: result[1]
      };
    };
    registerAppRoutes = function(app) {
      app.sessionId = guid();
      app.geoipCity = new geoip.City(__dirname + "/../GeoLiteCity.dat");
      app.dynamicHelpers({
        base: function() {
          if ("/" === app.route) {
            return "";
          } else {
            return app.route;
          }
        }
      });
      app.helpers({
        config: config
      });
      app.configure(function() {
        app.use(express["static"](__dirname + "/../static"));
        app.use(express.bodyParser());
        app.use(express.cookieParser());
        return app.use(express.errorHandler({
          dumpExceptions: true,
          showStack: true
        }));
      });
      app.set("views", __dirname + "/../views");
      app.set("view engine", "jade");
      app.get("/", function(req, res, next) {
        var opts;
        opts = {
          loggedOut: false,
          roomCounts: getRoomCounts()
        };
        if (req.query && req.query.logout === "true") opts.loggedOut = true;
        return res.render("index", opts);
      });
      app.get("/counts", function(req, res) {
        res.setHeader("content-type", "application/json");
        return res.end(JSON.stringify(getRoomCounts()));
      });
      app.get("/index.html", function(req, res) {
        return res.redirect("/", 301);
      });
      app.get("/about-us", function(req, res) {
        return res.render("about-us");
      });
      app.get("/about-us.html", function(req, res) {
        return res.redirect("/about-us", 301);
      });
      app.get("/contact", function(req, res) {
        return res.render("contact");
      });
      app.get("/faq", function(req, res) {
        return res.render("faq");
      });
      app.get("/privacy-policy", function(req, res) {
        return res.render("privacy-policy");
      });
      app.get("/privacypolicy.html", function(req, res) {
        return res.redirect("/privacy-policy", 301);
      });
      app.get("/terms-of-service", function(req, res) {
        return res.render("terms-of-service");
      });
      app.get("/tos.html", function(req, res) {
        return res.redirect("/terms-of-service", 301);
      });
      app.get("/vent", function(req, res) {
        return res.render("chat", {
          type: "venter",
          layout: "minimal-layout"
        });
      });
      app.get("/listen", function(req, res) {
        if ((process.env.NODE_ENV || "development") === "development") {
          return res.render("chat", {
            type: "listener",
            layout: "minimal-layout"
          });
        } else {
          return authServer.checkLogin(req, function(username) {
            if (username) {
              return vB_dao.getEmailAndJoindateForUser(username, function(vB_info) {
                return res.render("chat", {
                  type: "listener",
                  layout: "minimal-layout",
                  email: vB_info.email,
                  created_at: vB_info.created_at,
                  show_intercom: true
                });
              });
            } else {
              return feedbackServer.ipAddressHasNeverReceivedNegativeFeedback(req.headers["x-forwarded-for"] || req.address.address, function(clean_record) {
                if (clean_record) {
                  return res.render("chat", {
                    layout: "minimal-layout",
                    type: "listener",
                    show_intercom: false
                  });
                } else {
                  return res.render("listener-registration");
                }
              });
            }
          });
        }
      });
      app.get("/chat.html", function(req, res) {
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
        return res.redirect("/", 301);
      });
      app.get("/system", function(req, res) {
        return res.render("system");
      });
      app.post("/system", function(req, res) {
        var message;
        if (req.body.password !== config.systemPassword) {
          return res.send("Wrong password");
        } else if (!req.body.message) {
          return res.send("No message provided");
        } else if (req.body.restart && isNaN(parseInt(req.body.restartTime, 10))) {
          return res.send("Bad restart time specified");
        } else {
          message = req.body.message;
          forceLatency(function() {
            return socketIO.sockets.json.send({
              t: "sysmsg",
              d: message
            });
          });
          if (req.body.restart) {
            setTimeout((function() {
              return require("child_process").spawn("forever", ["restart", "app.js"]);
            }), parseInt(req.body.restartTime, 10) * 1000);
          }
          return res.send("Successfully sent " + JSON.stringify(message));
        }
      });
      app.get("/leaderboard", function(req, res) {
        return authServer.checkLogin(req, function(username) {
          return feedbackServer.getLeaderboard(true, function(top15) {
            if (username) {
              return feedbackServer.getLeaderboardForUser(username, function(userStats) {
                return res.render("leaderboard", {
                  scores: top15,
                  username: username,
                  userLeaderboard: userStats
                });
              });
            } else {
              return res.render("leaderboard", {
                scores: top15,
                username: username
              });
            }
          });
        });
      });
      require("./rooms/actions")(app);
      return log.addActions(app);
    };
    if (!config.serveMerged) {
      mergeStatic = function(callback) {
        return callback("", "");
      };
    }
    return mergeStatic(function(jsHash, cssHash) {
      app.helpers({
        jsHash: jsHash,
        cssHash: cssHash
      });
      util.puts("Registering app routes");
      registerAppRoutes(app);
      util.puts("Registering Socket.IO");
      registerSocketIO(app);
      app.listen(config.port);
      return util.puts("Server started on port " + config.port);
    });
  })();

}).call(this);
