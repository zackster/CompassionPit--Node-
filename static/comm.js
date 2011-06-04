/*jshint eqnull: true browser: true*/
/*global io: false*/

(function (exports) {
    "use strict";

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

    exports.create = function () {
        var socket = new io.Socket();

        var connectCallbacks = [],
            disconnectCallbacks = [];

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
        var lastMessageReceived = 0;
        var currentConnectIndex = 0;
        var sentConnectedEvents = false;
        
        socket.on('connect', function () {
            log("connect");
            
            currentConnectIndex += 1;
            isRegistered = false;
            var registerMessage = {
                t: "register"
            };
            if (userId) {
                registerMessage.d = {
                    u: userId,
                    n: lastMessageReceived
                };
            }
            socket.send(registerMessage);
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

        var checkSend;
        var requests = {};
        var handlers = {};
        socket.on('message', function (data) {
            if (!isRegistered) {
                if (data.t === "register") {
                    var message = arrayify(data.d);
                    var oldUserId = userId;
                    userId = message[0];
                    var lastReceivedMessage = message[1];
                    
                    if (oldUserId && userId !== oldUserId) {
                        unregister();
                    }
                    
                    isRegistered = true;
                    log("registered " + JSON.stringify(message));
                    
                    checkSend(lastReceivedMessage);
                    
                    if (!sentConnectedEvents) {
                        sentConnectedEvents = true;
                        for (var i = 0, len = connectCallbacks.length; i < len; i += 1) {
                            connectCallbacks[i](firstConnect);
                        }
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
                    log("Unknown message");
                }
            }
        });
        
        var sendQueue = [];
        var sendBacklog = [];
        
        unregister = function () {
            log("unregister");
            if (sentConnectedEvents) {
                sentConnectedEvents = false;
                for (var i = 0, len = disconnectCallbacks.length; i < len; i += 1) {
                    disconnectCallbacks[i]();
                }
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
                    socket.send(backlogMessages);
                }
            }
            
            if (sendQueue.length > 0) {
                socket.send(sendQueue);
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
            connect: function (callback) {
                connectCallbacks.push(callback);
            },
            disconnect: function (callback) {
                disconnectCallbacks.push(callback);
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
                socket.connect();
            },
            forceReconnect: function () {
                socket.disconnect(true);
            }
        };
    };
}(window.Comm = {}));