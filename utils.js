(function () {
    "use strict";
    
    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }
    exports.S4 = S4;
    function guid() {
        return S4() + S4() + S4() + S4() + S4() + S4();
    }
    exports.guid = guid;
}());