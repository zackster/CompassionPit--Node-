
var http = require('http');

var Client = function (type) {
    var self = this;
    self.type = type;
    self.options = { host: 'localhost',
		     port: 8080,
		   };
    self.room_id = -1;

    self.connect = function () {
	var options = self.options;
	options.path = '/join';

	http.get(options, function (res) {
	    var data = '';
	    res.on('data', function (chunk) { data += chunk });
	    res.on('end', function () {
		data = JSON.parse(data);
		self.room_id = data.id;
		console.log("Connected to '"+self.room_id+"'");
	    });
	}).on('error', function (e) {
	    console.log('Join error: ', e);
	});
    }
};

var venter = new Client('venter');
venter.connect();