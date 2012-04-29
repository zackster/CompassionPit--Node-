"use strict"
fs = require("fs")
uglify = require("uglify-js")
sqwish = require("sqwish")
config = require("./config")
hashlib = require("hashlib2")

module.exports = (finishCallback) ->
  scripts = config.scripts
  styles = config.styles
  scriptResults = []
  styleResults = []
  remaining = 0
  handleFinish = ->
    mergedJavascript = scriptResults.join(";\n\n\n")
    minifiedJavascript = undefined
    try
      minifiedJavascript = uglify(mergedJavascript)
    catch err
      console.warn err
      minifiedJavascript = mergedJavascript
    mergedCss = styleResults.join("\n\n\n")
    minifiedCss = undefined
    try
      minifiedCss = sqwish.minify(mergedCss)
    catch err
      console.warn err
      minifiedCss = mergedCss
    fs.writeFile __dirname + "/static/script.min.js", minifiedJavascript, ->
      fs.writeFile __dirname + "/static/style.min.css", minifiedCss, ->
        finishCallback hashlib.md5(minifiedJavascript).substring(0, 8), hashlib.md5(minifiedCss).substring(0, 8)  if finishCallback

  scripts.forEach (script, i) ->
    remaining += 1
    fs.readFile __dirname + "/static/" + script, (err, result) ->
      throw err  if err
      scriptResults[i] = result
      remaining -= 1
      handleFinish()  if remaining is 0

  styles.forEach (style, i) ->
    remaining += 1
    fs.readFile __dirname + "/static/" + style, (err, result) ->
      throw err  if err
      styleResults[i] = result
      remaining -= 1
      handleFinish()  if remaining is 0