var dnode = require('dnode');

var registration = function (details) {
  if(details==='success') {
    console.log("Successful Login!");
  }
  else if(details==='duplicate') {
    console.log("Duplicate username");
  }
  else {
    badFields = details;
    console.log("Problems with these fields: ", badFields);
    
  }
}

dnode.connect(5050, function (remote) {
    remote.login('bah@bah.com', 'passw3rd', n);
    
    remote.register('zack+isgreat@zackisgreat.com', 'lol', n);
});