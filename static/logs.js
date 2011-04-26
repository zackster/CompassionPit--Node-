(function ($, undefined) {
    "use strict";

    /*jshint browser: true jquery: true */
    var logTypes = ["info", "warn", "error"];
    var logData = null;
    
    var has = Object.prototype.hasOwnProperty;

    $(function () {
        var currentTab = "info";
        
        var addFilter;
        
        var currentFilters = {};
        var refreshTab = function () {
            if (!logData) {
                return;
            }

            var $tbody = $("#log-tbody");
            $tbody.empty();
            var logs = logData[currentTab] || [];
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
            refreshTab();
        };
        
        var fetching = false;
        var fetchNewData = function () {
            if (fetching) {
                return;
            }
            fetching = true;
            $.getJSON("/logs.json", function (data) {
                logData = data;

                for (var i = 0, len = logTypes.length; i < len; i += 1) {
                    var severity = logTypes[i];
                    $("#severity-tab-" + severity).text(severity + " (" + logData[severity].length + ")");
                }

                refreshTab();
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
                refreshTab();
            });
        });

        $("#severity-tab-info").click();
    });
}(jQuery));
