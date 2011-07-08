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
        var socket = io.connect(document.domain === "compassionpit.com" ? "compassionpit.com:8000" : null, {
            'max reconnection attempts': 5
        });
        
        var events = {};
        
        var emit = function (event) {
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
        
        socket.on('connect', function () {
            log("connect");
            
            currentConnectIndex += 1;
            isRegistered = false;
            var registerMessage = {
                t: "register",
            };
            registerMessage.d = {
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
            if (!isRegistered) {
                if (data.t === "register") {
                    var message = arrayify(data.d);
                    var oldUserId = userId;
                    var serverVersion = message[0];
                    var i, len;
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
                    
                    checkSend(lastReceivedMessage);
                    
                    if (!sentConnectedEvents) {
                        sentConnectedEvents = true;
                        emit('connect', firstConnect);
                    }
                    firstConnect = false;
                }
            } else {
                if (data.n > lastMessageReceived) {
                    data.n = lastMessageReceived;
                }
                if (data.i) {
                    var request = has.call(requests, data.i) && requests[data.i];
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
            }
        };
    };
}(window.Comm = {}, jQuery));