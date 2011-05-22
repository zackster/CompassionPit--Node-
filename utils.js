(function () {
    "use strict";
    
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
}());