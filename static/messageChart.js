(function ($, undefined) {
    $(function () {
        if ($("#chart_div").length === 0) {
            return;
        }
        
        var dates = window.dates;
        if (dates === undefined) {
            return;
        }
        window.dates = undefined;
        
        var has = Object.prototype.hasOwnProperty;
        
        var redraw = function () {
            var options = {};
            $("form#options")
                .serializeArray()
                .forEach(function (item) {
                    options[item.name] = item.value;
                });
            
            var grouping = parseInt(options.grouping, 10);
            var startTime = +new Date(options['start-time']);
            var endTime = +new Date(options['end-time']);
            
            var groups = {};
            for (var i = 0, len = dates.length; i < len; i += 1) {
                var date = dates[i];
                if (date < startTime || date > endTime) {
                    continue;
                }
                var group = Math.floor(date / grouping);
                groups[group] = (groups[group] || 0) + 1;
            };
            
            var minGroup = Math.floor(startTime / grouping);
            var maxGroup = Math.floor(endTime / grouping);
            var data = [];
            for (i = minGroup; i <= maxGroup; i += 1) {
                data.push([
                    i * grouping,
                    groups[i] || 0
                ]);
            }
            
            var info = { data: data };
            if (options.lines) {
                info.lines = { show: true }
            }
            if (options.bars) {
                info.bars = { show: true }
            }
            if (options.points) {
                info.points = { show: true }
            }
            
            $.plot(
                $("#chart_div"),
                [info],
                {
                    xaxes: [ { mode: 'time' } ],
                    yaxes: [ { min: 0 } ]
                });
        };
        
        $("form#options")
            .find("input")
            .change(function () {
                redraw();
            })
            .bind('datetimechange', function () {
                redraw();
            });
        
        var dateFormat = 'yy-mm-dd hh:ii';
        
        $("form#options input[name=end-time]")
            .val(new Date().format(dateFormat));
        
        $("form#options input[name=start-time]")
            .val((dates.length === 0 ? new Date() : new Date(dates[0] - (60 * 60 * 1000))).format(dateFormat))
            .datetime({
                chainTo: "form#options input[name=end-time]",
                format: dateFormat
            });
        
        redraw();
    });
}(jQuery));
