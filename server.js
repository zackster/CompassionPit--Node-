var fu  = require("./fu");
var sys = require("sys");
var nowjs = require("now");

var PORT = 8000;

var Room = function(id) {
	var self = this;
	self.id = id;
	self.last_access_time = new Date().getTime();
	self.messages = {
		listener: [],
		venter:   []
	};
	self.waiting = {
		listener: false,
		venter: false
	};
	self.start_timer = 0;
	self.venter = 0;
	self.listener = 0;
        self.group = nowjs.getGroup(id);
        self.clients = [];

        self.group.on('connect', function (clientId) {
        	self.clients.push(clientId);
        });

        self.group.on('disconnect', function (clientId) {
	        self.clients.splice(self.clients.indexOf(clientId), 1);
        	if (self.clients.length < 1) {
        	    delete_room(self.id);
	        }
        });
	
	self.poke = function (type) {
		self.last_access_time = new Date().getTime();
		if (type) self[type] = new Date().getTime();
	}
	
	self.expired = function () {
		return self.last_access_time < (new Date().getTime() - (1000 * 30));
	}
	
        self.send = function (type, opposite, message, clientId, callback) {
		self.poke(type);

		var messages = self.messages[opposite];
		if (message.action == "disconnect") {
		    self.group.removeUser(clientId);
			removeFromWaiters(self.id);
		}

        	self.group.now.receive([message]);

	        callback(true);
        }

	self.start = function () {
	    self.venter = self.listener = new Date().getTime();

	    self.group.now.receive([{action: 'join'}]);
	}
}

var waiters = {
	listener: [],
	venter:   []
};

var rooms = {};

function removeFromWaiters(room_id) {
	var idx = waiters["listener"].indexOf(room_id);
	if (idx != -1) waiters["listener"].splice(idx, 1);
	
	idx = waiters["venter"].indexOf(room_id);
	if (idx != -1) waiters["venter"].splice(idx, 1);
}


function delete_room(roomId) {
    console.log("Removing room", roomId);
    delete rooms[roomId];
}

fu.get("/counts", function (request, response) {
	var listeners = 0;
	var venters = 0;
	
	for (var i in rooms) {
		var room = rooms[i];
		if (room.listener) listeners += 1;
		if (room.venter) venters += 1;
	}
	
	response.simpleJSON(200, {
		listeners: listeners,
		venters: venters
	});
});
fu.get("/dump", function (request, response) {
	response.simpleText(200, sys.inspect(rooms));
})

// is there any particularly good reason for this to exist?
/*setInterval(function () {
	for (i in rooms) {
		var room = rooms[i];
		if (room.expired()) {
		    console.log("Removing room", i);
		    delete rooms[i];
		}
	}
}, 1000 * 10);
*/

fu.get("/", fu.staticHandler("static/index.html"));

fu.listen(PORT, null);

var everyone = nowjs.initialize(fu.server, {host: 'localhost',
				     port: 8080});

everyone.now.send = function (params, callback) {
    var callback = callback || function () {};

    var type = params.type;
    type = (type == "venter") ? "venter" : "listener";
    opposite = (type == "venter") ? "listener" : "venter";
    var room_id = params.rid;
    var message = {
	action: params.action,
	data: params.data,
	type: type
    };
	
    var room = rooms[room_id];
    if (!room) {
	callback(null);
	return;
    }

    room.send(type, opposite, message, this.user.clientId, callback);
};

// TODO, get rid of waiters and just look through the active rooms
// for a room that has the appropriate slot open. It's more brute-
// forcy, but it makes things simpler as well.
everyone.now.join = function (type, callback) {
    type = (type == "venter") ? "venter" : "listener";
    opposite = (type == "venter") ? "listener" : "venter";

    
    if (waiters[opposite].length) {
	// TODO loop through waiters until we find a room that is still defined (exists in rooms)
	var room_id = waiters[opposite].shift();
	try {
	    rooms[room_id].group.addUser(this.user.clientId);
	    rooms[room_id].start();
	    callback({ id: room_id });
	}
	catch (e) {
	    console.log("Error starting room:", e);
	    return callback({});
	}
	return;
    }
	
    var room_id = guid();
    var tmp_room = new Room(room_id);
    rooms[room_id] = tmp_room;
    
    waiters[type].push(room_id);

    tmp_room.group.addUser(this.user.clientId);
	
    callback({ id: room_id });
};


function S4() {
   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}
function guid() {
   return (S4()+S4()+S4()+S4()+S4()+S4());
}

