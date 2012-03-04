#!/bin/bash

echo "$NODE_ENV"
(
cd /opt/chat-staging/;
git reset --hard HEAD;
git pull;
NODE_ENV=staging;
echo "Set NODE_ENV to $NODE_ENV";
node leaderboard.js & node app.js;
echo "Started leaderboard.js";
echo "Started app.js";
)
echo "NODE_ENV is now $NODE_ENV"
