(function($,undefined) {
    "use strict";
	
	window.log = function (data) {
        try {
            var console = window.console;
            if (console && console.log) {
                console.log(data);
            }
        } catch (err) {
            // do nothing
        }
    };




  $(document).ready(function() {

    $("div#Chatmain, div#loggedInAs, div#reputationLogin, div#listenerFeedback, a#meant_to_login, button#register, li.scoreCard").hide();
    window.LISTENER_LOGGED_IN = false;

    var comm = window.Comm.create();
    comm.register();
    window.Chat.create();

  });


}(jQuery));
