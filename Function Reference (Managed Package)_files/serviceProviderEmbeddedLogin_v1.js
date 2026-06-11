'use strict';

/* global embeddedservice_bootstrap */

let oktaConfigs = {};

/**
 * function provides EL with required meta tags
 * reading environment meta tags from Community header markup
 * @param {String} orgcsSuffix tipically '-' + MyDomain identifier
 */
function provideSFIDSettings(orgcsSuffix = '-orgcs') {
    let communityPath;
    let helpcommunity = window.helpcommunity;

    helpcommunity.tbid = getTbid(orgcsSuffix);

    if (!helpcommunity || helpcommunity.tbid === null || helpcommunity.communityPath === undefined) {
        return;
    }
    communityPath = helpcommunity.communityPath;

    let metaTags = {
        'salesforce-brand': 'Help_Community',
        'salesforce-logout-handler': 'onLogout',
        'salesforce-login-handler': 'onLogin',
        'salesforce-init-handler': 'onInit',
        'salesforce-mode': 'authprovider',
        'salesforce-mask-redirects': 'true',
        'salesforce-authprovider-login': `${location.origin}${communityPath}/services/auth/sso/trailblazerloginCommunity`,
        'salesforce-authprovider-signup': `${location.origin}${communityPath}/services/auth/sso/trailblazersignupCommunity`,
        'salesforce-redirect-uri': `${location.origin}${communityPath}/services/authcallback/trailblazerloginCommunity`
    };

    for (let field in metaTags) {
        appendMeta(field, metaTags[field]);
    }

    if (window.SFIDWidget) {
        window.SFIDWidget.init();
    } else {
        let s = document.createElement('script');

        // Sets meta tags utilized in HC_TbidAuth.js to populate hyperlinks in profile component in global nav
        appendMeta('salesforce-community', oktaConfigs.oktaCommunityURL);
        appendMeta('salesforce-community-profile', oktaConfigs.oktaProfileURL);
        appendMeta('salesforce-community-settings', oktaConfigs.oktaSettingsURL);
        s.src = oktaConfigs.oktaSourceURL;

        s.async = true;
        s.defer = true;
        document.head.append(s);
    }
}

function getTbid(orgcsSuffix) {
    let host = window.location.host;
    let metaTagArray = Array.from(document.querySelectorAll(`meta[name$="${orgcsSuffix}"]`));
    let tbidMeta = metaTagArray.find((meta) => {
        let orgcs = meta.name.slice(0, -orgcsSuffix.length);
        if (
            host.includes(orgcs + '.com') ||
            host.includes(orgcs + '-helpandtraining.') ||
            host.includes(orgcs + '.sandbox.my.site.') ||
            host.includes(orgcs + '.help.')
        ) {
            return true;
        }
    });
    if (!(tbidMeta && tbidMeta.content)) {
        metaTagArray.forEach((meta) => {
            meta.remove();
        });
        return null;
    }
    metaTagArray.forEach((meta) => {
        meta.remove();
    });
    return tbidMeta.content;
}

function appendMeta(name, content) {
    let metaTag = document.createElement('meta');
    metaTag.name = name;
    metaTag.content = content;
    document.head.appendChild(metaTag);
}

function onInit() {
    if (window.tbidAuthProviderReady) {
        window.dispatchEvent(new CustomEvent('TBID_Init', { detail: { sfidWidget: window.SFIDWidget } }));
    }
}

/**
 * function will be called on login event of SFIDWidget
 * @param {Object} identity
 */
function onLogin(identity) {
    if (isPublicPage()) return;

    if (identity && !isLogged()) {
        if (window.tbidAuthProviderReady) {
            let event = new CustomEvent('TBID_Login', { detail: { identity: identity } });
            window.dispatchEvent(event);
        } else {
            let loginUrl = getLoginURL();
            if (loginUrl) {
                window.location.replace(loginUrl);
            }
        }
    }
}

/**
 * function is called on logout event of SFIDWidget
 */
function onLogout() {
    if (window.tbidAuthProviderReady) {
        let event = new CustomEvent('TBID_Logout', { detail: { sfidWidget: window.SFIDWidget } });
        window.dispatchEvent(event);
    } else {
        if (checkFalseLogout()) return;
        if (isLogged()) {
            window.location = `${window.helpcommunity.communityPath}/secur/logout.jsp`;
        }
    }

    // always end ASA sessions upon a TBID logout event
    endMessagingSession();
}

/**
 * End active messaging session if user's session contains an ongoing conversation id.
 */
function endMessagingSession() {
    const conversationId = sessionStorage.getItem('messagingConversationId');

    if (conversationId) {
        const event = new CustomEvent('endMessagingSession', {detail: {conversationId: conversationId, logout: true}});
        window.dispatchEvent(event);
    }
}

function checkFalseLogout() {
    for (let key in localStorage) {
        if (localStorage[key].includes('isLoggingOut')) {
            let lwcKeys = JSON.parse(localStorage[key]);
            localStorage.removeItem(lwcKeys['isLoggingOut']);
            return true;
        }
    }
    return false;
}

function isLogged() {
    return document.cookie.split(';').some((cookie) => cookie.trim().startsWith('sid_Client='));
}

function isOnLoginPage() {
    return document.location.pathname.includes('/s/login/');
}

function fetchStartUrl() {
    let startURLParamName = 'startURL=';
    let startURL = location.search.split('&').find((part) => {
        if (part.startsWith(startURLParamName)) {
            return true;
        }
    });
    if (startURL) {
        let result = decodeURIComponent(startURL.slice(startURLParamName.length));
        return result;
    }
}

function getTbidLoginURL() {
    let meta = document.querySelector('meta[name="salesforce-authprovider-login"]');
    if (meta && meta.content) {
        return meta.content;
    }
}

function getLoginURL() {
    let loginURL;

    let tbidLoginURL = getTbidLoginURL();
    if (!tbidLoginURL) {
        return null;
    }
    if (isOnLoginPage()) {
        let startURL = fetchStartUrl();
        if (startURL) {
            loginURL = `${tbidLoginURL}?startURL=${encodeURIComponent(startURL)}`;
        } else {
            loginURL = `${tbidLoginURL}?startURL=/`;
        }
    } else {
        loginURL = `${tbidLoginURL}?startURL=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    return loginURL;
}

function isPublicPage() {
    return (
        window.location.href.includes('/s/articleView') ||
        window.location.href.includes('/s/search-result') ||
        window.location.href.includes('/s/singlelogout')
    );
}

/**
 * listener for 'doTBIDLogout' event,
 * makes SFIDWidget logout
 */
window.addEventListener('doTBIDLogout', function (event) {
    if (window.SFIDWidget && window.SFIDWidget.config && window.SFIDWidget.logout) {
        window.SFIDWidget.logout();
        window.SFIDWidget.config = { domain: '' };
        window.SFIDWidget.init();
    }
});

window.addEventListener('TbidAuthProviderReady', function (event) {
    window.tbidAuthProviderReady = true;
});
/**
 * Event listener to get Okta configurations:
 * Feature flag, authProvider src URL and community metatag value.
 */
window.addEventListener('add_global_nav', function (event) {
    if (event.detail) {
        oktaConfigs.oktaCommunityURL = event.detail.config.oktaCommunityURL;
        oktaConfigs.oktaSourceURL = event.detail.config.oktaSourceURL;
        oktaConfigs.oktaProfileURL = event.detail.config.oktaProfileURL;
        oktaConfigs.oktaSettingsURL = event.detail.config.oktaSettingsURL;
    }
    provideSFIDSettings('-orgcs');
});
