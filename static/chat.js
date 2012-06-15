(function (exports, $, undefined) {
    "use strict";
    $("div#main").hide();
    var progressBarPct = 0;

    exports.progressBar = function (pct) {
        if (pct === 'init') {
            $("#progressbar").progressbar({value: 5});
            return;
        }
        progressBarPct += 15;
        if (pct === 100) {
            progressBarPct = 100;
            $("#initializing").fadeOut(1000, function () {
                $("#main").fadeIn(1000);
            });
        }
        $("#progressbar").progressbar({
            value: progressBarPct
        });
        $("span#secondsTilAppLoad").html(Math.max(+$("span#secondsTilAppLoad").html() - 1, 2));
    };

    exports.create = function () {

        var self = this;
        self.progressBar('init');
        $("#initializing").append('<br>'+'Chat create');
        for(var i = 1; i < 9; i = i+1) {
          setTimeout(self.progressBar, 1500*i);
        }

        if ($("#chatWindow").length === 0) {
            return;
        }

        window.LISTENER_LOGGED_IN = false;

        var comm = window.Comm.create();
        comm.register();

        var CLIENT_TYPE = window.CLIENT_TYPE;

        var OTHER_CLIENT_TYPE = (CLIENT_TYPE === 'listener') ? 'venter' : 'listener';
        var NEW_PARTNER_BUTTON_TIMEOUT = 10 * 1000;

        if(CLIENT_TYPE === 'listener') {
          $("div#reputationLogin").show();
		  $("#share_username").parent().parent().show();
        }
        $("div#main").css('height','405px').css('overflow-y','hidden');

        $("div#listenerFeedback button").click(function() {
          if(this.id === 'helpful') {
            send_positive_feedback();
          }
          else {
            send_negative_feedback();
          }
          $("div#listenerFeedback").hide();
        });

        function send_positive_feedback() {
          comm.request("listenerFeedback", {direction:'positive'});
        }

        function send_negative_feedback() {
          comm.request("listenerFeedback", {direction:'negative'});
        }

        window.showBrowserCloseMessage = true;
        window.onbeforeunload = function(event) {
            if (window.showBrowserCloseMessage) {
                return hasPartner ? 'Did you really mean to leave? Your partner will be disconnected.' : 'Did you really mean to leave?';
            }
        };

        window.comm = window.Comm.create();
        var hasPartner = false;
        var lastPartnerId = null;
        var currentPartnerId = null;
        var setHasPartner = function (value) {
            hasPartner = !!value;
            if (value) {
               $("#reportAbuse").show();

                setTimeout(function () {
                    if (hasPartner) {
                        $("#newPartner")
                            .removeClass("disabled");
                    }
                }, NEW_PARTNER_BUTTON_TIMEOUT);
                lastPartnerId = value;
                currentPartnerId = value;
            } else {
                $("#newPartner")
                    .addClass("disabled");
                $("#reportAbuse")
                    .hide();
                $("#typing_status").text('');
                currentPartnerId = null;
            }
        };
        setHasPartner(false);

        comm.on('connect', function () {
            // do nothing
        });
        comm.on('register', function (first, userId) {
            self.progressBar(100);
            //log('registered with id, ' + userId);
            addMessage('System', first ? 'Connected' : 'Reconnected');
            requestNewChatChannel(false);
        });
        comm.on('disconnect', function () {
        $("div#listenerFeedback").hide();
            addMessage('System', 'You have been disconnected. Trying to reconnect...', 'yellow-row');
            info("Reconnecting...");
            setHasPartner(false);
        });
        comm.on('reconnectFailed', function () {
            var $a = $("<a>")
                .attr("href", "")
                .text('Unable to reconnect. Click to reconnect.')
                .click(function () {
                    $a.replaceWith($("<span>")
                        .text('Unable to reconnect. Click to reconnect.'));
                    addMessage('System', "Reconnecting...");
                    comm.reconnect();
                    return false;
                });
            addMessage('System', $a);
            info('Connection error');
        });


        var wallpaper_timer;
        var playTetrisGame = function() {
        mixpanel.track("Played Game While Waiting");
        window.Chat.ENTERTAINMENT_RUNNING = true;
        $("#chat_input").hide();
        $("#column_left_chat").hide();
        $("#entertainmentGame").show();
    };
        $('#playRelaxingSounds').click(function() {
            mixpanel.track("Watched Landscape Sounds While Waiting");
            window.Chat.ENTERTAINMENT_RUNNING = true; $("#chat_input").hide(); $("#column_left_chat").hide();
            $("#entertainmentSounds").show();
            $("#entertainmentSounds").append($("<iframe width=\"1\" height=\"1\" src=\"http://www.youtube.com/embed/uupzk-YCBO0?rel=0&autoplay=1\" frameborder=\"0\"></iframe>"));
            var beautiful_wallpapers = ["the-other-side.jpg", "Hamad_Darwish_dot_com_Windows_Vista_Wallpapers_-3.jpg", "Hamad_Darwish_dot_com_Windows_Vista_Wallpapers_-5.jpg", "Hamad_Darwish_dot_com_Windows_Vista_Wallpapers_-16.jpg", "Hamad_Darwish_dot_com_Windows_Vista_Wallpapers_-6.jpg", "elbalia.jpg", "ethaer.jpg", "shimuna.jpg", "paramount.jpg", "brothers.jpg", "Monument_Valley.jpg", "TRILITH_by_tigaer.jpg", "Terragen___The_Way_God_Made_Me.jpg", "The_Rock_by_DJMattRicks.jpg", "Lost.jpg", "splatter.jpg", "Pacific.jpg", "Unforgettable-Days.jpg", "skyscrapers-&-lost-wonders_01.jpg", "winter-wonderland.jpg", "winter-landscape.jpg", "Mt_Buller.jpg", "Hamad_Darwish_dot_com_Windows_Vista_Wallpapers_-15.jpg", "forestfall.jpg", "Dashing.jpg", "meelup-beach.jpg", "tion.jpg", "Viva-La-Nature-5-(3).jpg", "Viva-La-Nature-5-(4).jpg", "Viva-La-Nature-5-(11).jpg", "Viva-La-Nature-5-(15).jpg", "on-the-beach.jpg", "red-rocks.jpg", "another-morning.jpg", "Atomicsunset.jpg", "waterfall-desktop.jpg", "461.jpg", "sea-of-plague.jpg", "Afternoon1_01.jpg", "Grassy.jpg", "Hamad_Darwish_dot_com_Windows_Vista_Wallpapers_-11.jpg", "Hamad_Darwish_dot_com_Windows_Vista_Wallpapers_-13.jpg", "Hamad_Darwish_dot_com_Windows_Vista_Wallpapers_-18.jpg", "Lone_Tree_1600.jpg", "a_place_to_rest.jpg", "12.jpg", "Jungle_Dreaming.jpg", "west-new-york-girl.jpg", "a_year_has_gone.jpg", "dedication.jpg", "azalea.jpg", "yellow-field.jpg", "Summer_Sunflowers.jpg", "The-Greenway.jpg", "Sun_ray_in_the_woods.jpg", "51200203.jpg", "stonehenge_wallpaper.jpg", "Spot_of_Light.jpg", "Wafting.jpg", "the-other-side.jpg", "4rest_by_UncleCameleon.jpg", "DarkblissWraith.jpg", "KingdomOfHeaven.jpg", "magic-tree.jpg", "Reaching_for_the_Stars.jpg", "dreamy-world.jpg", "447.jpg", "001.jpg", "002.jpg", "no-more-rain.jpg", "night_comes_down.jpg", "Nexus-by-Burning-Liquid.jpg", "thetismoon2k72.jpg", "jungle_bath.jpg", "beautiful-day.jpg"];
            var show_new_wallpaper = function() {
                var wallpaper = beautiful_wallpapers[Math.floor(Math.random() * beautiful_wallpapers.length)];
                var $wallpaper_img = $("<img></img>");
                $wallpaper_img.attr('src', 'img/' + wallpaper);
                $wallpaper_img.hide();

                $("#wallpapers img").fadeOut(2000, function() {
                    $(this).remove();
                    $("#wallpapers").append($wallpaper_img);
                    $("#wallpapers img").fadeIn(2000);
                });


            };

            show_new_wallpaper();
            wallpaper_timer = setInterval(function() { show_new_wallpaper(); }, 30*1000);
        });




        var $entertainment = $("div#entertainment");

        var resetEntertainment = function() {
            clearInterval(wallpaper_timer);
            window.Chat.ENTERTAINMENT_RUNNING = false;
            $("#entertainmentSounds iframe").remove();
            $("#column_left_chat").show();
             $("#chat_input").show();
            $("#entertainmentGame").hide();
            $("#entertainmentSounds").hide();
            $("#entertainment").hide();
        };

        var status = function(msg, cssClass, checkQueue) {

            checkingQueue = checkQueue && msg;

            var msgform = (msg === false);

            var $status = $('#status');
            $status.removeClass('errorMessage infoMessage');
            $status.addClass(cssClass);
            if(msgform) {
                $status.text("Connected");
                resetEntertainment();
            } else {
                $entertainment.show();
                $status.text(msg);
            }
            queryQueuePosition();
        };

        function info(msg) {
            status(msg, 'infoMessage');
        }

        function infoWithQueue(msg) {
            status(msg, 'infoMessage', true);
        }

        function error(msg) {
            status(msg, 'errorMessage');
        }

        var checkingQueue = false;
        var queryQueuePosition = function () {
            if (!checkingQueue) {
                return;
            }
            comm.request("queue", null, function (position) {
                if (checkingQueue) {
                    if (position < 0) {
                        $('#status').text(checkingQueue);
                        return;
                    } else {
                        $('#status').text(checkingQueue + " Queue #" + (position + 1));
                        setTimeout(queryQueuePosition, 5000);
                    }
                }
            });
        };

        var refocusInformInput = function () {
            setTimeout(function () {
                if ($("#inform").length > 0 && !$("#inform").is(":focus")) {
                    $("#inform").focus();
                }
            }, 0);
        };



        var spaces_only = /^\s+$/img;
        $('#chat_input').submit(function (event) {
            var chat_string = $(this).find("#inform").val();
            if(chat_string.length > 0 && !spaces_only.test(chat_string)) {
              sendMessage($("#inform").val());
            }
            refocusInformInput();
            return false;
        });

        $('#inform').keyup(function(e) {
          if((e.keyCode || e.which) === 13) { //Enter keycode
            $('#chat_input').trigger('submit');
          }
        });

        function requestNewChatPartner( priority, isAbuse ) {
            if (hasPartner) {
                setHasPartner(false);
                if (isAbuse) {
                    addMessage('System', 'This conversation has been reported as abuse. You are being connected to a new chat partner');
                } else {
                    addMessage('System', 'Please wait while we find you a new chat partner.');
                }
                requestNewChatChannel(true, priority, isAbuse);
            }
        }

        function requestNewChatPartnerPriority() {
            requestNewChatPartner( true );
        }

        var hasFocus = true;
        $(window).bind("blur", function() {
            hasFocus = false;
        });
        $(window).bind("focus", function() {
            hasFocus = true;
            document.title = 'CompassionPit | Chat';
            refocusInformInput();
        });

        $('#enable_sound').attr('checked', true);
        $("#enable_sound").change(function() {
            if (window.Chat.ENTERTAINMENT_RUNNING && !$(this).attr('checked')) {
                $("#entertainmentSounds iframe").remove();
            }
            else if (window.Chat.ENTERTAINMENT_RUNNING) {
                $("#entertainmentSounds").append($("<iframe width=\"1\" height=\"1\" src=\"http://www.youtube.com/embed/uupzk-YCBO0?rel=0&autoplay=1\" frameborder=\"0\"></iframe>"));
            }
        });
        $('#enable_typing').attr('checked', true);
        info('Initializing');
        $("#main").hide();

        $('#audioPlayer')
            .jPlayer({
                ready: function() {
                    $('#audioPlayer').jPlayer('setMedia', {
                        mp3: '/shortgong.mp3'
                    });
                },
                swfPath: '/',
                reload: 'auto',
                supplied: "mp3"
            });

        $('#newPartner').live( 'click', function() {
            if ($(this).hasClass("disabled")) {
                return false;
            }
            $("#apologies").show();

        });
    $("#giveApology").live('click', function() {
        addMessage(OTHER_CLIENT_TYPE, $("#apologySelect").val());
        $("#apologies").hide();
            requestNewChatPartner();
            refocusInformInput();
            return false;

    });


        $('#reportAbuse').live( 'click', function() {
            if ($(this).hasClass("disabled")) {
                return false;
            }
            requestNewChatPartner(false, true);
            refocusInformInput();
            window.alert("This listener has been reported as abusive.");
            return false;
        });

        function requestNewChatChannel(forceNewPartner, priority, isAbuse) {
            setHasPartner(false);

            comm.request("join", {
                type: CLIENT_TYPE,
                partnerId: (!forceNewPartner && lastPartnerId) || undefined,
                priority: priority,
                isAbuse: isAbuse
            }, function () {
                if (!hasPartner) {
                    infoWithQueue('Waiting for a chat partner... ');
                }
            });
            info('Waiting for a chat partner... ');
            addMessage("System", "Searching for a chat partner...");
        playTetrisGame();
        }

        function gong() {
            try {
                $('#audioPlayer')
                    .jPlayer('playHead', 0)
                    .jPlayer('play');
            } catch(err) {
            }
        }
        window.gong = gong;

        var scrollToBottomOfChat = function () {
            if(!window.Chat.ENTERTAINMENT_RUNNING) {
                var scrollDiv = document.getElementById("column_left_chat"); //scroll to bottom of chat
                scrollDiv.scrollTop = scrollDiv.scrollHeight;
            }
        };

        var rageSubstitute = function($td){
            var rages = ['/yuno', '/yey', '/wtf', '/why', '/whoa', '/wetodddog', '/welp', '/wayevil', '/wat', '/vuvu', '/uhm', '/trollmom', '/trolldad', '/troll', '/trap', '/teethrage', '/sweetjesus', '/surprised', '/suprised', '/straight', '/steve', '/stare', '/son', '/serious', '/schlick', '/sadtroll', '/sad', '/rtroll', '/rmilk', '/red', '/poker', '/pissed', '/pickletime', '/pfttxt', '/pft', '/perfect', '/omg', '/okay', '/ohcrap', '/notsure', '/notokay', '/notbad', '/nomegusta', '/milk', '/melvin', '/megustaperfect', '/megusta', '/longneck', '/lol', '/jizzsplosion', '/jackieeeee!', '/itstime', '/ilovethebeefytaco', '/ifeelsyabreh', '/hmm', '/high', '/hehheh', '/harpdarp', '/happy', '/gyey', '/gwat', '/gwah', '/guhm', '/gtroll', '/gtongue', '/gtfo', '/gsmile', '/gserious', '/gohno', '/ghappy', '/gfu', '/gbeh', '/gaytroll', '/gah', '/fy1', '/futext', '/fumanchu', '/fuckthatshit', '/fu', '/freddie', '/foreveralonelaugh', '/foreveralone', '/femyao', '/fap', '/eyes', '/ewbtetext', '/ewbte', '/dude', '/deviltroll', '/creepy', '/challengeaccepted', '/cereal', '/bzz', '/blackhair', '/biggusta', '/beh', '/awyeah', '/awyea', '/awman', '/aintthatsomeshit'];
            window._.each(rages.reverse(), function(value, key, list) {
                $td.html($td.html().replace(new RegExp("(\\" + value + ")", "g"), '<a href="' + value + '"/>'));
            });
        };

        i = 0;
        window.msgCount = 0;
        window.treatment_type = Math.floor(Math.random()*3)+1;
        var titleCurrentlyChanging = false;
        function addMessage(from, msg, cssClass) {
            var $td = $("<span>");
            if (msg instanceof $) { // when the fuck does this happen.  trace it some time when you're sober, jackass.
                $td.append(msg);
            } else {
                $td.text(capitalize(from) + ": " + msg);
            }
            window.msgCount+=1;
            if(window.msgCount===5 && window.treatment_type===1) {
				var script2   = document.createElement("script");
				script2.type  = "text/javascript";
				script2.src   = "http://pagead2.googlesyndication.com/pagead/show_ads.js";

				var script   = document.createElement("script");
				script.type  = "text/javascript";
				script.text  = 'google_ad_client = "ca-pub-6036766792552196";google_ad_slot = "7147599266";google_ad_width = 468;google_ad_height = 60;';
				$("#header .container a > .logo").replaceWith(script);
				$("#header .container script").after(script2);
            }
            else if(window.msgCount===10 && window.treatment_type===2) {
				script2   = document.createElement("script");
				script2.type  = "text/javascript";
				script2.src   = "http://pagead2.googlesyndication.com/pagead/show_ads.js";

				script   = document.createElement("script");
				script.type  = "text/javascript";
				script.text  = 'google_ad_client = "ca-pub-6036766792552196";google_ad_slot = "0427669924";google_ad_width = 468;google_ad_height = 60;';
				$("#header .container a > .logo").replaceWith(script);
				$("#header .container script").after(script2);
            }
            else if(window.msgCount===15 && window.treatment_type===3) {
				script2   	  = document.createElement("script");
				script2.type  = "text/javascript";
				script2.src   = "http://pagead2.googlesyndication.com/pagead/show_ads.js";

				script	 	 = document.createElement("script");
				script.type  = "text/javascript";
				script.text  = 'google_ad_client = "ca-pub-6036766792552196";google_ad_slot = "6283430487";google_ad_width = 468;google_ad_height = 60;';
				$("#header .container a > .logo").replaceWith(script);
				$("#header .container script").after(script2);
            }
            rageSubstitute($td);
            $('#chatWindow > div:last')
                .append($("<div>")
                    .addClass(cssClass || (from === 'Me' ? 'blue-row' : from === 'System' ? 'off-white-row' : 'white-row'))
                    .append($td));
            scrollToBottomOfChat();
            if(!hasFocus && !titleCurrentlyChanging) {
                changeTitle();
                if($("#enable_sound").is(':checked')) {
                    gong();
                }
            }
        }

        function changeTitle() {
            i = i + 1;
            if(i%2) {
                document.title = 'New message on CompassionPit!';
            }
            else {
                document.title = 'CompassionPit | Chat';
            }
            if(!hasFocus) {
                titleCurrentlyChanging = true;
                setTimeout(changeTitle,1000);
            }
            else {
                titleCurrentlyChanging = false;
                i=0;
                document.title = 'CompassionPit | Chat';
            }
        }

		$('#share_username').change(function() {
			if ($(this).is(':checked')){
               addMessage('System', 'Your partner can now see when your forums username');
               comm.request("showUsername");
            } else {
               addMessage('System', 'Your partner will no longer be able to see your forums username');
               comm.request("hideUsername");
            }            			
		});
        $('#enable_typing').change(function(){
            if ($(this).is(':checked')){
               addMessage('System', 'Others can now see when you\'re typing');
               comm.request("typing", {state: 'on'});
            } else {
                addMessage('System', 'Others can no longer see when you\'re typing');
                comm.request("typing", {state: 'off'});
            }
        });

        var isTyping = false;
        $('#chat_input').bind('change keydown keyup',function (){
            if ($('#enable_typing').is(':checked')){
                if (!isTyping){
                    comm.request("typing", {state: 'start'});
                    isTyping = true;
                }

                window.clearTimeout(this.timeoutID);
                delete this.timeoutID;

                this.timeoutID = window.setTimeout(
                    function(){
                        comm.request("typing", {state: 'stop'});
                        isTyping = false;
                    },2000
                );
            }
        });


        function sendMessage(msg) {
            mixpanel.track("Chatted to " + OTHER_CLIENT_TYPE + " chat partner");
            if (msg === '' || !hasPartner) {
                return;
            }

            addMessage('Me', msg);
            info(false);
            $('#inform').val('');

            comm.request("msg", msg, function (data) {
                if (data !== true) {
                    addMessage('System', 'Failed to send message.', 'yellow-row');
                }
            });
            comm.request("typing", {state: 'stop'});
        }

        comm.handler("sysmsg", function (message) {
            addMessage("System", message, 'yellow-row');
        });
        comm.handler("msg", function (type, message) {
            mixpanel.track("Received chat from " + OTHER_CLIENT_TYPE + " chat partner");
            if (type !== CLIENT_TYPE) {
                addMessage(type, message);
                $("#abuseButtonContainer")
                    .removeClass("hidden");
            }
        });
		comm.handler("forum-username", function(username) {
			if(username) {
				$("#partnerUsername").html('<b>' + username + '</b>');				
				$("#partnerUsername").show();
			}
			else {
				$("#partnerUsername").hide();
			}
		});
        comm.handler("received-feedback", function(message) {
          window.comm.request("updateHUD", {}, function(userLeaderboard) {
              $('li.scoreCard').show().css('display', 'block !important').css('height', 'auto');
              $("#score").text('Points ' + userLeaderboard.score + ' | Rank ' + userLeaderboard.rank);
              $("#diff").text('You now need ' + userLeaderboard.diff + ' points to overtake the next spot on the leaderboard');
          });

          switch (message) {
            case "positive":
              if(window.LISTENER_LOGGED_IN) {
                $('div.announce').html('Your venter has rated you a good listener!');
              }
              else {
                $('div.announce').html('Your venter has rated you a good listener! Use your <a href="http://www.compassionpit.com/forum/" target="_blank">CompassionPit forums account</a> to tie this feedback to your account:');
              }
              break;
            case "negative":
              $('div.announce').html('Your venter has indicated that you are not a good listener.  Perhaps you could ask them how you can be a better listener.  You will now need to register an account, in order to prevent abuse.');
              if(!window.LISTENER_LOGGED_IN) {
                setTimeout(function() {
                    window.location = 'http://www.compassionpit.com/listen';
                }, 1000*45);
              }
              break;
            default:
              break;
          }

        });
        comm.handler("typing", function (type, message) {
            if (type !== CLIENT_TYPE && hasPartner) {
                switch (message.state){
                    case "on":
                        addMessage('System', 'You will now be able to see when '+type+' is typing');
                        break;

                    case "off":
                        addMessage('System', 'You will no longer be able to see when '+type+' is typing');
                        break;

                    case "start":
                        $("#typing_status").text(type + ' is typing');
                        break;

                    case "stop":
                        $("#typing_status").text('');
                        break;
                }
            }
        });
        comm.handler("join", function (otherUserId, type, geoInfo) {
            if (type !== CLIENT_TYPE) {
                var oldUserId = lastPartnerId;
                setHasPartner(otherUserId);
                // log("join " + otherUserId);
                info(false);

                var message;
                if (otherUserId === oldUserId) {
                    // we were properly reconnected!
                    // don't need to show geoinfo, since it's the same partner as before.
                    message = 'You were reconnected with your previous ' + OTHER_CLIENT_TYPE;
                } else {
                    // new partner
                    if (geoInfo) {
                        // we have geolocation info.
                        addMessage('System', 'A new ' + OTHER_CLIENT_TYPE + ' has entered your chat from ' + geoInfo);
                        message = 'We are sharing the listener\'s location with you so you do not accidentally share vulnerable information with someone you know in real life. Your location has NOT been shared with the listener.';
                    } else {
                        message = 'A new ' + OTHER_CLIENT_TYPE + ' has entered your chat';
                    }
                    mixpanel.track("Successfully connected to " + OTHER_CLIENT_TYPE + " chat partner");
                    if(CLIENT_TYPE === 'venter') {
                      $("div#listenerFeedback").show();
                    }
                }
                addMessage('System', message);
            }


        });

        var includeLikeButtonScript = function () {
            $('#chatWindow > div:last')
                .append($('<div class="off-white-row">')
                    .append($("<span>")
                        .append($("<iframe>", {
                            allowTransparency: "true",
                            frameborder: 0,
                            scrolling: "no",
                            style: "width:100%;height:24px;border:none;overflow:hidden;",
                            src: "http://www.facebook.com/plugins/like.php?href=http%3A%2F%2Fwww.compassionpit.com&amp;layout=standard&amp;show_faces=false&amp;width=450&amp;action=like&amp;colorscheme=light&amp;height=24"
                        }))));

            $('#chatWindow > div:last')
                .append($('<div class="off-white-row">')
                    .append($("<span>")
                        .append($('<a href="https://twitter.com/share" data-url="http://www.CompassionPit.com" data-text="CompassionPit: get it off your chest without it biting you in the ass" data-count="horizontal" data-via="CompassionPit" class="twitter-share-button">Tweet</a><script type="text/javascript" src="//platform.twitter.com/widgets.js"></script>'))));
            scrollToBottomOfChat();
        };

        comm.handler("partRequest", function (type) {
            // partner requested a new match, automatically reconnect
        $("div#listenerFeedback").hide();
            addMessage( 'System', 'Your chat partner disconnected, please wait while we find you a new ' + OTHER_CLIENT_TYPE + '.' );
            setHasPartner( false );

            includeLikeButtonScript();

            infoWithQueue( 'Waiting for a new partner... ' );
        });
        comm.handler("partDisconnect", function (type) {
            var container = $( '<span></span>' );

            var button = $( '<a></a>', {
                'href'  : '#',
                'text'  : 'Click here'
            });

            button.click( function() {
                requestNewChatPartnerPriority();
                refocusInformInput();

                return false;
            });

            container
                .append( 'Your partner has left the chat. ' )
                .append( button )
                .append( ' to be connected to a new ' + OTHER_CLIENT_TYPE + '.' );

            addMessage( 'System', container );

            includeLikeButtonScript();

            info('Partner disconnected.');
        });

        function capitalize(text) {
            return text.charAt(0).toUpperCase() + text.substring(1);
        }

        return {
            restart: function () {
                comm.register();
            }
        };
    };

}(window.Chat = {}, jQuery));
