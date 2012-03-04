#!/bin/bash

(
cd /opt/chat-staging/;
git reset --hard HEAD;
git pull;
killall screen;
export NODE_DEBUG=module;
NODE_ENV=staging;
screen -d -m node leaderboard.js;
screen -d -m node app.js;
)
