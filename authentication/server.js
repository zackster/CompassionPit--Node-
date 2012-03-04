(function() {
  

  var mongoose = require('mongoose');

  var Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId;

  var Users = mongoose.model('Users', new Schema({
        email       : {
                        type:       String,
                        validate:   new RegExp('[a-z0-9!#$%&\'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&\'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?'),
                        index:      {
                                      unique:     true,
                                      dropDups:   true
                                    }
                      }
      , password    : {
                        type:       String,
                        validate:   [function(str) { return str.length>0; }]
                      }
  }));
  


  function Server() {
    
      this.logged_in_users = {};
    
      this.getEmailFromListenerId = function(id) {
        
        return this.logged_in_users[id];
        
      };
      
      this.login = function (id, email, password, callback) { 
        if(typeof(callback)!=='function') return;
        var self = this;
        Users.find({'email': email, 'password': password}, function(err, docs) {
          if(err) {
            console.log('An error occurred: ' + err);
          }
          else {          
            if(docs.length) {
              self.logged_in_users[id] = email;
              callback('success');              
              return true;
            }
            else {
              callback('failure');
              return false;
            }
          }
        });
      
      };
      
      this.register = function(id, email, password) {
        var self=this;
        var instance = new Users();
        instance.email = email;
        instance.password = password;
        instance.save(function(err) {
          status = {};
          if(err && err.errors) {
            badFields = [];
            for (badField in err.errors) {
              badFields.push(badField);
            };          
            console.log("bad fields" + badFields);
            return {success: false, error: badFields};
          }
          else if(err) {          
            callback('duplicate');
            console.log('duplicates' + err);
            return {success: false, error: 'duplicate'};
          }
          else {
            self.logged_in_users[id] = email;
            console.log('success');
            return {success: true};
          }
        });
      };
  }  
  

  
  exports.authServer = function() {
    return new Server();
  }
  
})();