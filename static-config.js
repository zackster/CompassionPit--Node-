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
        "jquery.ui.progressbar.js",
        "jquery.html5-placeholder-shim.js",
        "jquery.cookies.2.2.0.min.js",
        "socket.io/socket.io.js",
        "comm.js",
        "chat.js",
        "index.js",
        "logs.js",
        "messageChart.js"
    ];
    config.styles = [
        "css/reset.css",
        "css/style.css",
        "css/abuse.css",
        "jquery-ui-1.8.13.custom.css",
        "jquery.ui.datetime.css",
        "css/jquery-ui/jquery.ui.all.css"
    ];
    config.version = 0;
    require('child_process').exec("git log -1 --format=format:%H", {
        cwd: __dirname
    }, function (err, stdout, stderr) {
        if (err) {
            console.warn(err);
        } else {
            config.version = stdout.replace(/\s+/, "");
        }
    });
};
