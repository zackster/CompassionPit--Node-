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

    $("div#Chatmain, div#loggedInAs, li#rejoin, div#reputationLogin, div#partnerUsername, div#listenerFeedback, a#meant_to_login, button#register, li.scoreCard").hide();
	$("#share_username").parent().parent().hide();
	$("#encourage_twitter_follow").parent().parent().hide();
    window.LISTENER_LOGGED_IN = false;

    var comm = window.Comm.create();
    comm.register();
    window.Chat.create();

  });


}(jQuery));
