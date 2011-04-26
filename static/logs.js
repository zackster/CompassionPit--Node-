(function ($, undefined) {
    "use strict";

    /*jshint browser: true jquery: true */
    var logTypes = ["info", "warn", "error"];
    var logEntries = null;
    var logCounts = null;
    
    var has = Object.prototype.hasOwnProperty;

    $(function () {
        var currentTab = "info";
        
        var addFilter;
        
        var currentFilters = {};
        var refreshDisplayedEntries = function () {
            if (!logEntries) {
                return;
            }

            var $tbody = $("#log-tbody");
            $tbody.empty();
            var logs = logEntries[currentTab] || [];
            logs.forEach(function (entry) {
                for (var filterKey in currentFilters) {
                    if (has.call(currentFilters, filterKey)) {
                        if (entry[filterKey] !== currentFilters[filterKey]) {
                            return;
                        }
                    }
                }
                
                $tbody.append(
                    $("<tr>")
                        .append($("<td>")
                            .text(new Date(entry.time).toString()))
                        .append($("<td>")
                            .append((!currentFilters.event ? $("<a>")
                                .attr("href", "#")
                                .click(function () {
                                    addFilter("event", entry.event);
                                    return false;
                                }) : $("<span>"))
                                .text(entry.event)))
                        .append((function () {
                            var $ul = $("<ul>");
                            Object.keys(entry).forEach(function (key) {
                                if (key !== "time" && key !== "event") {
                                    var $item;
                                    if (currentFilters[key]) {
                                        $item = $("<span>");
                                    } else {
                                        $item = $("<a>")
                                            .attr("href", "#")
                                            .click(function () {
                                                addFilter(key, entry[key]);
                                                return false;
                                            });
                                    }
                                    $ul
                                        .append($("<li>")
                                            .append($item
                                                .css("white-space", "pre")
                                                .text(key + ": " + entry[key])));
                                }
                            });
                            return $("<td>")
                                .append($ul);
                        }())));
            });
        };
        
        var refresh = function () {
            var $tbody = $("#counts-tbody");
            var counts = [];
            for (var severity in logCounts) {
                if (has.call(logCounts, severity)) {
                    var countsBySeverity = logCounts[severity];
                    for (var event in countsBySeverity) {
                        if (has.call(countsBySeverity, event)) {
                            var count = countsBySeverity[event];
                            counts.push({
                                severity: severity,
                                event: event,
                                count: count
                            });
                        }
                    }
                }
            }
            counts.sort(function (a, b) {
                return a.count < b.count;
            });
            $tbody.empty();
            counts.forEach(function (data) {
                $tbody
                    .append($("<tr>")
                        .append($("<td>")
                            .text(data.severity))
                        .append($("<td>")
                            .text(data.event))
                        .append($("<td>")
                            .text(data.count)));
            });
            
            refreshDisplayedEntries();
        };
        
        addFilter = function (key, value) {
            if (value === undefined) {
                delete currentFilters[key];
            } else {
                currentFilters[key] = value;
                
                var $filter = $("<div>")
                    .append($("<a>")
                        .attr("href", "#")
                        .click(function () {
                            addFilter(key, undefined);
                            $filter.remove();
                            return false;
                        })
                        .css("white-space", "pre")
                        .text(key + ": " + value));
                $("#filters")
                    .append($filter);
            }
            refreshDisplayedEntries();
        };
        
        var fetching = false;
        var fetchNewData = function () {
            if (fetching) {
                return;
            }
            fetching = true;
            $.getJSON("/logs.json", function (data) {
                logEntries = data.entries;
                logCounts = data.counts;

                for (var i = 0, len = logTypes.length; i < len; i += 1) {
                    var severity = logTypes[i];
                    $("#severity-tab-" + severity).text(severity + " (" + logEntries[severity].length + ")");
                }

                refresh();
                fetching = false;
            });
        };
        fetchNewData();
        
        $("#refresh").click(function () {
            fetchNewData();
        });

        $(".severity-tab").each(function () {
            var severity = $(this).data("severity");

            $(this).click(function () {
                currentTab = severity;
                refreshDisplayedEntries();
            });
        });

        $("#severity-tab-info").click();
    });
}(jQuery));
