(function () {
    "use strict";
    
    var fs = require('fs'),
        uglify = require('uglify-js'),
        sqwish = require('sqwish'),
        config = require('./config'),
        hashlib = require('hashlib');
    
    module.exports = function (finishCallback) {
        var scripts = config.scripts;
        var styles = config.styles;
        
        var scriptResults = [];
        var styleResults = [];
        var remaining = 0;
        var handleFinish = function () {
            var mergedJavascript = scriptResults.join(";\n\n\n");
            var minifiedJavascript;
            try {
                minifiedJavascript = uglify(mergedJavascript);
            } catch (err) {
                console.warn(err);
                minifiedJavascript = mergedJavascript;
            }
            
            var mergedCss = styleResults.join("\n\n\n");
            var minifiedCss;
            try {
                minifiedCss = sqwish.minify(mergedCss);
            } catch (err) {
                console.warn(err);
                minifiedCss = mergedCss;
            }
            
            fs.writeFile(__dirname + "/static/script.min.js", minifiedJavascript, function () {
                fs.writeFile(__dirname + "/static/style.min.css", minifiedCss, function () {
                    if (finishCallback) {
                        finishCallback(hashlib.md5(minifiedJavascript).substring(0, 8), hashlib.md5(minifiedCss).substring(0, 8));
                    }
                });
            });
        };
        scripts.forEach(function (script, i) {
            remaining += 1;
            fs.readFile(__dirname + "/static/" + script, function (err, result) {
                if (err) {
                    throw err;
                }
                
                scriptResults[i] = result;
                remaining -= 1;
                if (remaining === 0) {
                    handleFinish();
                }
            });
        });
        styles.forEach(function (style, i) {
            remaining += 1;
            fs.readFile(__dirname + "/static/" + style, function (err, result) {
                if (err) {
                    throw err;
                }
                
                styleResults[i] = result;
                remaining -= 1;
                if (remaining === 0) {
                    handleFinish();
                }
            });
        });
    };
    
    if (!module.parent) {
        console.log("Starting");
        module.exports(function () {
            console.log("All done");
        });
    }
}());