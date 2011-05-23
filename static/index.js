(function ($, undefined) {
    $(function () {
        if ($("#listener-count").length === 0) {
            return;
        }
        
        var comm = Comm.create();
        comm.start();
        
        var updateCounts = function() {
            console.log("request counts");
            comm.request("counts", null, function (data) {
                console.log(data);
                var listeners = data.l;
                var venters = data.v;
                
                $('#listener-count').text(listeners);
                $('#venter-count').text(venters);

                $('#counts').hide();
                $('#need-listeners').hide();
                $('#need-venters').hide();
                $('#need-anyone').hide();

                if (listeners || venters) {
                    $('#counts').show();
                    if (listeners > venters) {
                        $('#need-venters').show();
                    }
                    else if (venters > listeners) {
                        $('#need-listeners').show();
                    }
                }
                else {
                    $('#need-anyone').show();
                }
            });
            setTimeout(updateCounts, 10 * 1000);
        }
        updateCounts();
    });
}(jQuery));