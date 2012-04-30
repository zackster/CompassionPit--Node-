(function() {
  "use strict";
  var config, fs, hashlib, sqwish, uglify;

  fs = require("fs");

  uglify = require("uglify-js");

  sqwish = require("sqwish");

  config = require("./config");

  hashlib = require("hashlib2");

  module.exports = function(finishCallback) {
    var handleFinish, remaining, scriptResults, scripts, styleResults, styles;
    scripts = config.scripts;
    styles = config.styles;
    scriptResults = [];
    styleResults = [];
    remaining = 0;
    handleFinish = function() {
      var mergedCss, mergedJavascript, minifiedCss, minifiedJavascript;
      mergedJavascript = scriptResults.join(";\n\n\n");
      minifiedJavascript = void 0;
      try {
        minifiedJavascript = uglify(mergedJavascript);
      } catch (err) {
        console.warn(err);
        minifiedJavascript = mergedJavascript;
      }
      mergedCss = styleResults.join("\n\n\n");
      minifiedCss = void 0;
      try {
        minifiedCss = sqwish.minify(mergedCss);
      } catch (err) {
        console.warn(err);
        minifiedCss = mergedCss;
      }
      return fs.writeFile(__dirname + "/static/script.min.js", minifiedJavascript, function() {
        return fs.writeFile(__dirname + "/static/style.min.css", minifiedCss, function() {
          if (finishCallback) {
            return finishCallback(hashlib.md5(minifiedJavascript).substring(0, 8), hashlib.md5(minifiedCss).substring(0, 8));
          }
        });
      });
    };
    scripts.forEach(function(script, i) {
      remaining += 1;
      return fs.readFile(__dirname + "/static/" + script, function(err, result) {
        if (err) throw err;
        scriptResults[i] = result;
        remaining -= 1;
        if (remaining === 0) return handleFinish();
      });
    });
    return styles.forEach(function(style, i) {
      remaining += 1;
      return fs.readFile(__dirname + "/static/" + style, function(err, result) {
        if (err) throw err;
        styleResults[i] = result;
        remaining -= 1;
        if (remaining === 0) return handleFinish();
      });
    });
  };

}).call(this);
