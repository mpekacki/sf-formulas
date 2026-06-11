'use strict';

//H&T Community Coveo Script
//provides analytics requests for OOTB components
//Keep up to date with CMS components updates

(function () {
    const CUSTOM_EVENT_TYPE = 'coveoCustomEvent';

    //Debug values
    const HOME_PAGE_REDIRECT_DEBUG_VALUE = 1854;

    //Event types
    const HOME_PAGE_REDIRECT_EVENT_TYPE = 'Home Page Redirect';

    //H&T Community pages
    const HOME_PAGE = 'HelpHome';

    //Page sections
    const RESOURCES_SECTION = 'Resources';
    const VIDEOS_SECTION = 'Videos';
    const SUPPORT_FOR_OTHER_PRODUCTS_SECTION = 'Additional Product Support';

    //Sync the below link arrays up with the corresponding CMS collections
    let resourcesSectionElementLinks = [
        'https://trailblazers.salesforce.com/', //Trailblazer Community
        'https://trailhead.salesforce.com/', //Trailhead
        getSuccessCenterUrl(), //Success Center
        'https://successcenter.salesforce.com/s/', //Success Center prod
        'https://cs.salesforce.com/' //Events
    ];

    //also known as Additional Product Support
    let supportForOtherProductsSectionElementLinks = [
        'https://www.tableau.com/support', //Tableau
        'https://www.heroku.com/support', //Heroku
        'https://help.mulesoft.com/s/', //Mulesoft
        'https://www.slack.com/help' //Slack
    ];

    //Videos
    let videosSectionElementLinks = [
        'https://www.youtube.com/channel/UCbrOrrE0lOR2LcfycryZwHw', //Support YouTube Channel
        'https://cs.salesforce.com/events?filter=true&product=&category=&region=&language=en&type=video&search=On%20Demand&startDate=&endDate=&dateSpan=custom', //Expert Coaching Videos for English
        'https://cs.salesforce.com/events?filter=true&product=&category=&region=&language=de&type=video&search=&startDate=&endDate=&dateSpan=custom', //Expert Coaching Videos for German
        'https://cs.salesforce.com/events?filter=true&product=&category=&region=&language=es&type=video&search=&startDate=&endDate=&dateSpan=custom', //Expert Coaching Videos for Spanish
        'https://cs.salesforce.com/events?filter=true&product=&category=&region=&language=fr&type=video&search=On%20Demand&startDate=&endDate=&dateSpan=custom', //Expert Coaching Videos for French
        'https://cs.salesforce.com/events?filter=true&product=&category=&region=&language=it&type=video&search=&startDate=&endDate=&dateSpan=custom', //Expert Coaching Videos for Italian
        'https://cs.salesforce.com/events?filter=true&product=&category=&region=&language=jp&type=video&search=&startDate=&endDate=&dateSpan=custom', //Expert Coaching Videos for Japanese
        'https://cs.salesforce.com/events?filter=true&product=&category=&region=&language=en&type=video&search=&startDate=&endDate=&dateSpan=custom', //Expert Coaching Videos for Other Languages
        'https://cs.salesforce.com/events?filter=true&product=&category=&region=&language=ko&type=video&search=&startDate=&endDate=&dateSpan=custom', //Expert Coaching Videos for Korean
        'https://cs.salesforce.com/events?filter=true&product=&category=&region=&language=zh&type=video&search=&startDate=&endDate=&dateSpan=custom', //Expert Coaching Videos for Chenese
        'https://cs.salesforce.com/events?filter=true&product=&category=&region=&language=pt&type=video&search=&startDate=&endDate=&dateSpan=custom', //Expert Coaching Videos for Portugese
        'https://cs.salesforce.com/events?filter=true&product=&category=&region=&language=nl&type=video&search=&startDate=&endDate=&dateSpan=custom', //Expert Coaching Videos for Dutch
        'https://www.salesforce.com/events/webinars/' //Webinar Video Channel
    ];

    let linksSize = 0;

    function getSuccessCenterUrl() {
        let url = window.location.href;
        let baseUrl = url.slice(0, url.indexOf('/', 8));
        return baseUrl + '/successcenter/s/';
    }

    function enableAnalyticsHandlers(elementList) {
        if (elementList) {
            let element;
            let size = elementList.length;
            linksSize = size;

            for (let i = 0; i < size; i++) {
                element = elementList[i];

                if (enableAnalyticsLargeCards(element)) continue;

                if (enableAnalyticsOnMediumCards(element)) continue;

                if (!element.text) continue;

                enableAnalyticsOnCircleUI(element);
            }
        }
    }

    //Resources, Accelerators, Webinars cards
    function enableAnalyticsLargeCards(element) {
        if (
            element.classList.contains('js-content-title') &&
            element.classList.contains('js-content-navlink') &&
            element.classList.contains('slds-text-heading_large')
        ) {
            let source = defineSource(element.href);
            let button = defineButton(element);

            if (source && button && source.eventValue === RESOURCES_SECTION) {
                enableCustomAnalyticsOnElement(
                    element,
                    HOME_PAGE_REDIRECT_DEBUG_VALUE,
                    source.eventType,
                    source.eventValue,
                    source.searchInterface,
                    source.originLevel3,
                    source.originLevel4,
                    button
                );
                return true;
            }
        }
    }

    //Additional Product Support, Videos cards
    function enableAnalyticsOnMediumCards(element) {
        if (
            element.classList.contains('js-content-title') &&
            element.classList.contains('js-content-navlink') &&
            element.classList.contains('slds-text-heading_medium')
        ) {
            let source = defineSource(element.href);
            let button = defineButton(element);

            if (
                source &&
                button &&
                (source.eventValue === VIDEOS_SECTION || source.eventValue === SUPPORT_FOR_OTHER_PRODUCTS_SECTION)
            ) {
                enableCustomAnalyticsOnElement(
                    element,
                    HOME_PAGE_REDIRECT_DEBUG_VALUE,
                    source.eventType,
                    source.eventValue,
                    source.searchInterface,
                    source.originLevel3,
                    source.originLevel4,
                    button
                );
                return true;
            }
        }
    }

    //Circle UI +
    function enableAnalyticsOnCircleUI(element) {
        if (
            element.classList.contains('bannerLayoutButton') &&
            element.classList.contains('slds-button') &&
            element.classList.contains('slds-button_brand')
        ) {
            enableCustomAnalyticsOnElement(
                element,
                HOME_PAGE_REDIRECT_DEBUG_VALUE,
                HOME_PAGE_REDIRECT_EVENT_TYPE,
                element.text,
                HOME_PAGE,
                document.referrer,
                element.text,
                ''
            );
        }
    }

    function enableCustomAnalyticsOnElement(
        element,
        actionDebugValue,
        eventType,
        eventValue,
        searchInterface,
        originLevel3,
        originLevel4,
        originLevel5
    ) {
        if (element) {
            element.onclick = () => {
                window.dispatchEvent(
                    new CustomEvent(CUSTOM_EVENT_TYPE, {
                        detail: {
                            payload: {
                                eventType: eventType,
                                eventValue: eventValue,
                                searchInterface: searchInterface,
                                actionDebugValue: actionDebugValue,
                                customData: {
                                    Title: eventValue,
                                    ContentTitle: eventValue,
                                    Referrer: document.referrer,
                                    ContentViewPage: '',
                                    originLevel3: originLevel3,
                                    originLevel4: originLevel4,
                                    originLevel5: originLevel5
                                }
                            }
                        }
                    })
                );
            };
        }
    }

    function defineButton(element) {
        if (element && element.children.length === 1) {
            if (element.children[0].children.length === 1 && element.children[0].children[0].nodeName === 'SPAN') {
                return element.children[0].children[0].textContent;
            }
        }
        return '';
    }

    function defineSource(href) {
        if (href) {
            if (resourcesSectionElementLinks.includes(href)) {
                return {
                    eventType: HOME_PAGE_REDIRECT_EVENT_TYPE,
                    eventValue: RESOURCES_SECTION,
                    searchInterface: HOME_PAGE,
                    originLevel3: document.referrer,
                    originLevel4: RESOURCES_SECTION
                };
            }
            if (supportForOtherProductsSectionElementLinks.includes(href)) {
                return {
                    eventType: HOME_PAGE_REDIRECT_EVENT_TYPE,
                    eventValue: SUPPORT_FOR_OTHER_PRODUCTS_SECTION,
                    searchInterface: HOME_PAGE,
                    originLevel3: document.referrer,
                    originLevel4: SUPPORT_FOR_OTHER_PRODUCTS_SECTION
                };
            }
            if (videosSectionElementLinks.includes(href)) {
                return {
                    eventType: HOME_PAGE_REDIRECT_EVENT_TYPE,
                    eventValue: VIDEOS_SECTION,
                    searchInterface: HOME_PAGE,
                    originLevel3: document.referrer,
                    originLevel4: VIDEOS_SECTION
                };
            }
        }
    }

    function linksChecker() {
        if (linksSize !== document.links.length) {
            enableAnalyticsHandlers(document.links);
        }
    }

    const timer = setInterval(enableAnalyticsHandlers, 500, document.links);

    document.addEventListener('readystatechange', () => {
        if (document.readyState === 'complete') {
            setTimeout(
                function (timer) {
                    clearInterval(timer);
                },
                15000,
                timer
            );
        }
    });
})();
