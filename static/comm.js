(function (exports) {
    var log = function (data) {
        try {
            if (console && console.log) {
                console.log(data);
            }
        } catch (err) {
            // do nothing
        }
    };

    var makeId = (function () {
        var i = 0;
        return function () {
            i += 1;
            return i;
        };
    }());
    
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
        
        var firstConnect = true;
        socket.on('connect', function () {
            log("connect");
            
            for (var i = 0, len = connectCallbacks.length; i < len; i += 1) {
                connectCallbacks[i](firstConnect);
            }
            firstConnect = false;
        });
        socket.on('disconnect', function () {
            log("disconnect");
            
            for (var i = 0, len = disconnectCallbacks.length; i < len; i += 1) {
                disconnectCallbacks[i]();
            }
        });
        
        var requests = {};
        var handlers = {};
        socket.on('message', function (data) {
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
        });
        
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
                socket.send(chunk);
            },
            handler: function (type, callback) {
                handlers[type] = callback;
            },
            start: function () {
                socket.connect();
            }
        };
    };
}(window.Comm = {}));