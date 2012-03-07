/*jshint eqnull: true browser: true*/
/*global io: false*/

(function (exports, $, undefined) {
    "use strict";
    
    
    var VERSION = window.COMPASSION_PIT_VERSION;
    window.COMPASSION_PIT_VERSION = undefined;

    var log = function (data) {
        try {
            var console = window.console;
            if (console && console.log) {
                console.log(data);
            }
        } catch (err) {
            // do nothing
        }
    };

    // amount of time to consider a disconnect a "real" disconnect.
    var DISCONNECT_LEEWAY = 10 * 1000;
    
    var BACKLOG_SIZE = 100;
    
    var isArray = Array.isArray || function (item) {
        return Object.prototype.toString.call(item) === "[object Array]";
    };

    var arrayify = function (item) {
        if (item == null) { // undefined or null
            return [];
        } else if (isArray(item)) {
            return item;
        } else {
            return [item];
        }
    };

    var has = Object.prototype.hasOwnProperty;
    
    
    var versionIssue = (function () {
        var showedVersionBar = false;
        return function () {
            if (showedVersionBar) {
                return;
            }
            showedVersionBar = true;
            $("body")
                .prepend($("<div>")
                    .attr("id", "version-bar")
                    .append($("<a>")
                        .attr("href", "")
                        .click(function () {
                            window.showBrowserCloseMessage = false;
                        })
                        .append($("<p>")
                            .text("A new version of CompassionPit is available. Click here to Refresh."))));
        };
    }());

    exports.create = function () {
        $("#initializing").append('<br>'+"Socket connection started");
        
        if(/compassionpit\.com/i.test(document.domain)) {
          var socketio_addr = /staging\.compassionpit\.com/i.test(document.domain) ? "staging.compassionpit.com:8001" : "compassionpit.com:8000";
        }
        else {
          var socketio_addr = null;
        }
        
        log('determining sio addr');

        var socket = io.connect(socketio_addr, {
            'max reconnection attempts': 5,
            'force new connection': true,
        });
        window.globalSocket = socket;
        
        var events = {};
        
        log('declaring emit');
        var emit = function (event) {
          log("Emit was called for event " + event);
            var callbacks = has.call(events, event) && events[event];
            if (callbacks) {
                var args = Array.prototype.slice.call(arguments, 1);
                for (var i = 0, len = callbacks.length; i < len; i += 1) {
                    var callback = callbacks[i];
                    callback.apply(undefined, args);
                }
            }
        };

        var makeId = (function () {
            var i = 0;
            return function () {
                i += 1;
                return i;
            };
        }());
        
        var firstConnect = true;
        var isRegistered = false;
        var userId = null;
        var publicUserId = null;
        var lastMessageReceived = 0;
        var currentConnectIndex = 0;
        var sentConnectedEvents = false;

        var register = function () {
          log("big register method being called.");
            currentConnectIndex += 1;
            isRegistered = false;
            var registerMessage = {
                t: "register",
            };
            var referrer = document.cookie.match('referrer=([^;]+)') || [];
            registerMessage.d = {
                r: decodeURIComponent(referrer[1]),
                a: String(navigator.userAgent),
                v: VERSION
            };
            if (userId) {
                registerMessage.d.u = userId;
                registerMessage.d.p = publicUserId;
                registerMessage.d.n = lastMessageReceived;
            }
            socket.json.send(registerMessage);
            log("Sent register message: " + JSON.stringify(registerMessage));
            Chat.progressBar();
            $("#initializing").append('<br>'+"Sent register message via socket");
        };

        socket.on('connect', function () {
            log("socket connect");
            Chat.progressBar();
            $("#initializing").append('<br>'+"Connected to the socket");
            log("We are about to emit connect");
            emit("connect");
            log("We are about to call register");
            register();
            
        });
        
        var unregister;
        socket.on('disconnect', function () {
            log("disconnect");
            
            if (isRegistered) {
                isRegistered = false;
                
                var lastConnectIndex = currentConnectIndex;
                setTimeout(function () {
                    if (lastConnectIndex !== currentConnectIndex) {
                        return;
                    }
                    
                    unregister();
                }, DISCONNECT_LEEWAY);
            }
        });
        
        socket.on('reconnecting', function (x, y) {
            log('reconnecting. Delay: ' + x + '. Attempts: ' + y);
        });
        
        socket.on('reconnect_failed', function () {
            emit('reconnectFailed');
        });

        var checkSend;
        var requests = {};
        var handlers = {};
        socket.on('message', function (data) {
          log("Received a message.");
          log(data);
            if (!isRegistered) {
                if (data.t === "register") {
                    var message = arrayify(data.d);
                    var oldUserId = userId;
                    var serverVersion = message[0];
                    if (serverVersion !== VERSION) {
                        versionIssue();
                    }
                    var isNewUser = message[1];
                    userId = message[2];
                    publicUserId = message[3];
                    var lastReceivedMessage = message[4];
                    
                    if (oldUserId && (isNewUser || userId !== oldUserId)) {
                        unregister();
                    }
                    
                    isRegistered = true;
                    log("registered " + (isNewUser ? "new user" : "reclaimed user") + " " + userId + "/" + publicUserId);
                    $("#initializing").append('<br>'+"Received register message via socket");
                    Chat.progressBar();
                    
                    checkSend(lastReceivedMessage);
                    
                    if (!sentConnectedEvents) {
                        sentConnectedEvents = true;
                        emit('register', firstConnect, userId);
                    }
                    firstConnect = false;
                }
            } else {
                if (data.n > lastMessageReceived) {
                    data.n = lastMessageReceived;
                }
                if (data.i) {
                    var request = has.call(requests, data.i) && requests[data.i];  // the callback function that was passed for this request id
                    if (request) {
                        delete requests[data.i];
                        request.apply(undefined, arrayify(data.d));
                    }
                } else if (data.t) {
                    var handler = has.call(handlers, data.t) && handlers[data.t];
                    if (handler) {
                        handler.apply(undefined, arrayify(data.d));
                    } else {
                        log("Unhandled message: " + data.t);
                    }
                } else {
                    log("Unknown message: " + JSON.stringify(data));
                }
            }
        });
        
        var sendQueue = [];
        var sendBacklog = [];
        
        unregister = function () {
            log("unregister");
            if (sentConnectedEvents) {
                sentConnectedEvents = false;
                emit('disconnect');
            }
            sendQueue.length = 0;
            sendBacklog.length = 0;
        };
        
        checkSend = function (lastReceivedMessage) {
            if (!isRegistered) {
                return;
            }
            
            if (lastReceivedMessage != null) {
                var backlogMessages = [];
                for (var i = 0, len = sendBacklog.length; i < len; i += 1) {
                    var message = sendBacklog[i];
                    if (message.i > lastReceivedMessage) {
                        backlogMessages.push(message);
                    }
                }
                if (backlogMessages.length > 0) {
                    log("Sent " + backlogMessages.length + " backlogged messages");
                    for (var j = 0, len = backlogMessages.length; j < len; j += 1) {
                        socket.json.send(backlogMessages[j]);
                    }
                }
            }
            
            if (sendQueue.length > 0) {
                for (var k = 0, len = sendQueue.length; k < len; k += 1) {
                    socket.json.send(sendQueue[k]);
                }
                sendBacklog.push.apply(sendBacklog, sendQueue);
                sendQueue.length = 0;
                if (sendBacklog.length > BACKLOG_SIZE) {
                    sendBacklog.splice(0, sendBacklog.length - BACKLOG_SIZE);
                }
            }
        };
        
        var send = function (message) {
            sendQueue.push(message);
            checkSend();
        };
        
        log('returning from comm');

        return {
            on: function (event, callback) {
                if (!has.call(events, event)) {
                    events[event] = [];
                }
                events[event].push(callback);
            },
            request: function (type, data, callback) {
                var id = makeId();
                var chunk = {t: type, i: id};
                if (data != null) { // null or undefined
                    chunk.d = data;
                }
                requests[id] = callback;
                send(chunk);
            },
            handler: function (type, callback) {
                handlers[type] = callback;
            },
            start: function () {
                socket.socket.reconnect();
            },
            reconnect: function () {
                socket.socket.disconnect();
                socket.socket.reconnect();
            },
            register: function (userId) {
                log("calling register method");
                register();
            }
        };
    };
    
}(window.Comm = {}, jQuery));