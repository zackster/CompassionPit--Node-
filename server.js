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

    self.group.on('connect', function (clientId) {
	console.log(self.waiting);
	if (self.waiting.listener && self.waiting.venter) {
	    console.log("sending receive to all");
	    self.group.now.receive([{action: 'join'}]);
	}
    });

    self.group.on('disconnect', function (clientId) {
	self.group.now.receive([{action: 'disconnect'}]);
    });
	
	self.poke = function (type) {
		self.last_access_time = new Date().getTime();
		if (type) self[type] = new Date().getTime();
	}
	
	self.expired = function () {
		return self.last_access_time < (new Date().getTime() - (1000 * 30));
	}
	
	self.receive = function (type, callback) {
		self.poke(type);
		var messages = self.messages[type];


	    // this looks suspicious
		/*if (!messages.length) {
			var timeout = setTimeout(function () {
				self.waiting[type] = false;
				response.simpleJSON(200, []);
			}, 10 * 1000);
			
			self.waiting[type] = function() {
				response.simpleJSON(200, messages);
				messages.length = 0;
				self.waiting[type] = false;
				clearTimeout(timeout);
			};
			
			return;
		}*/

	    callback(messages, function () {
		messages.length = 0;
	    });
		//messages.length = 0;
	}
	
    self.send = function (type, opposite, message, callback) {
		self.poke(type);

		var messages = self.messages[opposite];
		if (message.action == "disconnect") {
			removeFromWaiters(self.id);
		}

	self.group.now.receive([message]);

//		messages.push(message);
//		if (self.waiting[opposite]) self.waiting[opposite]();

	callback(true);
    }

	self.start = function () {
		self.venter = self.listener = new Date().getTime();
		self.messages["listener"].push({
			action: "join"
		});
		self.messages["venter"].push({
			action: "join"
		});
		if (self.waiting["listener"]) self.waiting["listener"]();
		if (self.waiting["venter"]) self.waiting["venter"]();

		/*self.start_timer = setInterval(function () {
			var now = new Date().getTime();
			if ((self.venter < (now - (20 * 1000))) ||
			    (self.listener < (now - (20 * 1000)))) {
				self.messages["listener"].push({
					action: "disconnect"
				});
				if (self.waiting["listener"]) self.waiting["listener"]();
				self.messages["venter"].push({
					action: "disconnect"
				});
				if (self.waiting["venter"]) self.waiting["venter"]();
				
				removeFromWaiters(self.id);
				
				clearInterval(self.start_timer);
			}
		}, 1000 * 2);*/
	}
}

var waiters = {
	listener: [],
	venter:   []
};

function removeFromWaiters(room_id) {
	var idx = waiters["listener"].indexOf(room_id);
	if (idx != -1) waiters["listener"].splice(idx, 1);
	
	idx = waiters["venter"].indexOf(room_id);
	if (idx != -1) waiters["venter"].splice(idx, 1);
}

var rooms = {};

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

setInterval(function () {
	for (i in rooms) {
		var room = rooms[i];
		if (room.expired()) {
			console.log("Removing room", i);
			delete rooms[i];
		}
	}
}, 1000 * 10);


fu.get("/", fu.staticHandler("static/index.html"));

fu.listen(PORT, null);

var everyone = nowjs.initialize(fu.server, {host: 'localhost',
				     port: 8080});

everyone.now.send = function (params, callback) {
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

    room.send(type, opposite, message, callback);
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
	    return rooms[room_id].receive(type, function (data, callback) {
		rooms[room_id].group.now.receive(data, callback);
	    });
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

