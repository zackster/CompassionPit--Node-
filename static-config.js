module.exports = function (config) {
    config.scripts = [
        "json2.js",
        "es5-shim.js",
        "jquery-1.6.1.js",
        "error-handling.js",
        "jquery.jplayer.js",
        "jquery.flot.js",
        "jquery.ui.core.js",
        "jquery.ui.widget.js",
        "jquery.ui.datepicker.js",
        "jquery.ui.datetime.src.js",
        "socket.io.js",
        "comm.js",
        "chat.js",
        "index.js",
        "logs.js",
        "messageChart.js"
    ];
    config.styles = [
        "css/reset.css",
        "css/style.css",
        "jquery-ui-1.8.13.custom.css",
        "jquery.ui.datetime.css"
    ];
};