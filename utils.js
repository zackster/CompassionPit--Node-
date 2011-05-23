(function () {
    "use strict";
    
    /*global setTimeout: false */
    
    /**
     * Generate a 4-character random hex string
     */
    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }
    exports.S4 = S4;
    
    /**
     * Generate a 24-character random hex string
     */
    function guid() {
        return S4() + S4() + S4() + S4() + S4() + S4();
    }
    exports.guid = guid;
    
    var has = Object.prototype.hasOwnProperty;
    /**
     * Create a prototype-less Object which acts as a simple hash map.
     *
     * @param {Object} data An object to copy data from. Optional.
     * @param {Boolean} freeze Whether to freeze the hash before returning.
     */
    exports.createHash = function (data, freeze) {
        var hash = Object.create(null);
        if (data) {
            for (var key in data) {
                if (has.call(data, key)) {
                    hash[key] = data[key];
                }
            }
        }
        if (freeze) {
            Object.freeze(hash);
        }
        return hash;
    };
    
    /**
     * Force a lag to occur based on the configuration setting forceLatency.
     * This is for testing purposes only and the time should be set to 0 in production
     * to provide as fast an experience as possible.
     *
     * @param {Function} callback The callback to run after the faked latency.
     */
    exports.forceLatency = (function () {
        var LATENCY_TIME = require("./config").forceLatency;
        if (LATENCY_TIME <= 0) {
            return function (callback) {
                callback();
            };
        } else {
            return function (callback) {
                setTimeout(callback, LATENCY_TIME);
            };
        }
    }());
    
    /**
     * Wrap a function to execute only after a latency based on the configuration
     * setting forceLatency.
     * This is for testing purposes only and the time should be set to 0 in production
     * to provide as fast an experience as possible.
     *
     * @param {Function} callback The callback to wrap.
     */
    exports.latencyWrap = (function () {
        var LATENCY_TIME = require("./config").forceLatency;
        if (LATENCY_TIME <= 0) {
            return function (callback) {
                return callback;
            };
        } else {
            return function (callback) {
                return function () {
                    var args = Array.prototype.slice.call(arguments, 0);
                    setTimeout(function () {
                        callback.apply(undefined, args);
                    }, LATENCY_TIME);
                };
            };
        }
    }());
}());