(function($,undefined) {


  $(document).ready(function() {
    

    $("div#main, div#loggedInAs, div#reputationLogin, div#listenerFeedback, a#meant_to_login, button#register").hide();
    var comm = window.Comm.create();
    comm.register();
    window.Chat.create();

  });
  
  
})(jQuery);
