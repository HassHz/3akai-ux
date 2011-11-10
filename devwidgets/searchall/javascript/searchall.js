/*
 * Licensed to the Sakai Foundation (SF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The SF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
// load the master sakai object to access all Sakai OAE API methods
require(["jquery", "sakai/sakai.api.core", "/dev/javascript/search_util.js"], function($, sakai){

    /**
     * @name sakai.WIDGET_ID
     *
     * @class WIDGET_ID
     *
     * @description
     * WIDGET DESCRIPTION
     *
     * @version 0.0.1
     * @param {String} tuid Unique id of the widget
     * @param {Boolean} showSettings Show the settings of the widget or not
     */
    sakai_global.searchall = function(tuid, showSettings){

        //////////////////////
        // Config variables //
        //////////////////////

        var $rootel = $("#" + tuid);

        // CSS IDs
        var search = "#searchall";

        var searchConfig = {
            search: "#searchall",
            global: {
                resultTemp: search + "_result_temp",
                button: search + "_button",
                text: search + '_text',
                numberFound: search + '_numberFound',
                searchButton: "#form .s3d-search-button"
            },
            results: {
                container: search + '_results_container',
                resultsContainer: search + '_results',
                resultsContainerAnonClass: 's3d-search-results-anon',
                template: 'search_general_results_template',
                noResultsTemplate: 'searchall_noresults_template'
            }
        };

        var infinityScroll = false;

        ///////////////
        // Functions //
        ///////////////

        /**
         * Take a list of search results retrieved by the server and process them so they are
         * ready to be run through the template
         * @param {Object} results     List of results coming back from the infinite scroll plugin
         * @param {Object} callback    Callback function from the infinite scroll plugin to call
         */
        var renderResults = function(results, callback){
            var userArray = [];
            var fetchUsers = false;

            // If we have results we add them to the object.
            if (results && results.length) {
                results = sakai_global.data.search.prepareCMforRender(results);
                results = sakai_global.data.search.prepareGroupsForRender(results);
                results = sakai_global.data.search.preparePeopleForRender(results);
                for (var item in results) {
                    if (results.hasOwnProperty(item)) {
                        // if the content has an owner we need to add their ID to an array,
                        // so we can lookup the users display name in a batch req
                        if (results[item]["sakai:pool-content-created-for"]) {
                            userArray.push(results[item]["sakai:pool-content-created-for"]);
                            fetchUsers = true;
                        }
                    }
                }
            }

            // Call the infinite scroll plugin callback
            callback(results);

            // Update dom with user display names
            if (fetchUsers) {
                sakai.api.User.getMultipleUsers(userArray, function(users){
                    for (u in users) {
                        if (users.hasOwnProperty(u)) {
                            setUsername(u, users);
                        }
                    }
                });
            }
            bindResultsEvents();
        };

        /**
         * As the search service only returns the userid for who was created a piece of
         * content, we need to seperately retrieve those user's profile information before
         * we can display their displayName on the screen. This function takes a users
         * profile information and fills out his displayname for all items created by him
         * @param {Object} u        Userid of the user we're putting a displayname in for
         * @param {Object} users    Profile objects of the retrieved users
         */
        var setUsername = function(u, users) {
            $(".searchcontent_result_username").each(function(index, val){
               var userId = $(val).text();
               if (userId === u){
                   $(val).html(sakai.api.User.getDisplayName(users[u]));
                   $(val).attr("title", sakai.api.User.getDisplayName(users[u]));
               }
            });
        };

        /**
         * This method will show all the appropriate elements for when a search is executed.
         */
        var showSearchAll = function(params){
            // Set search box values
            if (!params.q || (params.q === "*" || params.q === "**")) {
                $(searchConfig.global.text).val("");
            } else {
                $(searchConfig.global.text).val(params.q);
            }
            $(searchConfig.global.numberFound).text("0");
            $(searchConfig.results.container).html($(searchConfig.global.resultTemp).html());
        };

        /**
         * Render the default template when no results are found. This function will
         * be called by the infinite scroll plugin
         */
        var handleEmptyResultList = function(){
            $(searchConfig.results.container).html(sakai.api.Util.TemplateRenderer(searchConfig.results.noResultsTemplate, {sakai: sakai}));
        };

        /**
         * Kick off a search with a specific query and sort option. This function will
         * initiate an infinite scroll for each search
         */
        var doSearch = function(){
            var params = sakai_global.data.search.getQueryParams();
            var urlsearchterm = sakai.api.Server.createSearchString(params.cat || params.q);

            // get the sort by
            var sortBy = $("#search_select_sortby option:first").val();
            if (params["sortby"]){
                sortBy = params["sortby"];
            }

            // Set all the input fields and paging correct.
            showSearchAll(params);

            var url = sakai.config.URL.SEARCH_ALL_ENTITIES;
            if (urlsearchterm === '**' || urlsearchterm === '*') {
                $(window).trigger("lhnav.addHashParam", [{"q": "", "cat": ""}]);
                url = sakai.config.URL.SEARCH_ALL_ENTITIES_ALL;
            } else {
                $(window).trigger("lhnav.addHashParam", [{"q": params.q, "cat": params.cat}]);
            }

            // Disable the previous infinite scroll
            if (infinityScroll){
                infinityScroll.kill();
            }
            // Set up the infinite scroll for the list of search results
            infinityScroll = $(searchConfig.results.container).infinitescroll(url, {
                "q": urlsearchterm,
                "sortOn": "_lastModified",
                "sortOrder": sortBy
            }, function(items, total){
                // Adjust display global total
                $(searchConfig.global.numberFound, $rootel).text("" + total);
                return sakai.api.Util.TemplateRenderer(searchConfig.results.template, {
                    "items": items,
                    "sakai": sakai
                });
            }, handleEmptyResultList, sakai.config.URL.INFINITE_LOADING_ICON, renderResults);
        };

        ///////////////////
        // Event binding //
        ///////////////////

        $(searchConfig.global.text).live("keydown", function(ev){
            if (ev.keyCode === 13) {
                $.bbq.pushState({
                    "q": $(searchConfig.global.text).val(),
                    "cat": ""
                }, 0);
            }
        });

        $(searchConfig.global.searchButton).live("click", function(){
            $.bbq.pushState({
                "q": $(searchConfig.global.text).val()
            }, 0);
        })

        $(searchConfig.global.button).live("click", function(ev){
            $.bbq.pushState({
                "q": $(searchConfig.global.text).val(),
                "cat": ""
            }, 0);
        });

        $(window).bind("sakai.addToContacts.requested", function(ev, userToAdd){
            sakai_global.data.search.getMyContacts();
            $('.sakai_addtocontacts_overlay').each(function(index) {
                if ($(this).attr("sakai-entityid") === userToAdd.uuid){
                    $(this).hide();
                    $("#searchpeople_result_left_filler_"+userToAdd.uuid).show();
                }
            });
        });

        /*
         * Bindings that occur after we've rendered the search results.
         */
        var bindResultsEvents = function() {
            $('.searchgroups_result_plus',rootel).live("click", function(ev) {
                var joinable = $(this).data("group-joinable");
                var groupid = $(this).data("groupid");
                var itemdiv = $(this);
                sakai.api.Groups.addJoinRequest(sakai.data.me, groupid, false, true, function (success) {
                    if (success) {
                        if (joinable === "withauth") {
                            // Don't add green tick yet because they need to be approved.
                            var notimsg = sakai.api.i18n.getValueForKey("YOUR_REQUEST_HAS_BEEN_SENT");
                        } 
                        else  { // Everything else should be regular success
                            $("#searchgroups_memberimage_"+groupid,rootel).show();
                            var notimsg = sakai.api.i18n.getValueForKey("SUCCESSFULLY_ADDED_TO_GROUP");
                        }
                        sakai.api.Util.notification.show(sakai.api.i18n.getValueForKey("GROUP_MEMBERSHIP"),
                            notimsg, sakai.api.Util.notification.type.INFORMATION);
                        itemdiv.removeClass("s3d-action-icon s3d-actions-addtolibrary searchgroups_result_plus");
                    } else {
                        sakai.api.Util.notification.show(sakai.api.i18n.getValueForKey("GROUP_MEMBERSHIP"),
                            sakai.api.i18n.getValueForKey("PROBLEM_ADDING_TO_GROUP"),
                            sakai.api.Util.notification.type.ERROR);
                    }
                });
            });
        };

        /////////////////////////
        // Initialise Function //
        /////////////////////////

        if (sakai.data.me.user.anon){
            $(searchConfig.results.resultsContainer).addClass(searchConfig.results.resultsContainerAnonClass);
        }

        $(window).bind("hashchange", function(ev){
            if (!$.bbq.getState("l") || $.bbq.getState("l") === "all") {
                doSearch();
            }
        });

        $(window).bind("sakai.search.util.finish", function(ev, data){
            if (data && data.tuid === tuid){
                doSearch();
            }
        });

        $(window).trigger("sakai.search.util.init", [{"tuid": tuid}]);

    };

    // inform Sakai OAE that this widget has loaded and is ready to run
    sakai.api.Widgets.widgetLoader.informOnLoad("searchall");

});
