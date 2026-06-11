/**
 * This is to add canonical URL & Update HrefLang tags on articleView pages
 **/

let urlTemplate;
let currentLanguage;
let flag = true;

//This function accepts string href value and removes '/s' and correct the order of URL
const getModifiedURL = function (urlHrefValue) {
    urlHrefValue = encodeURI(urlHrefValue);
    let urlValue = new URL(urlHrefValue);
    let urlParamsFromCurrentURL = new URLSearchParams(urlValue.search);

    let urlId = urlParamsFromCurrentURL.has('id') ? flag?encodeURIComponent(urlParamsFromCurrentURL.get('id')):urlParamsFromCurrentURL.get('id') : '';
    let urlLanguage = urlParamsFromCurrentURL.has('language')
        ? flag?encodeURIComponent(urlParamsFromCurrentURL.get('language')):urlParamsFromCurrentURL.get('language')
        : currentLanguage;
    let urlType = urlParamsFromCurrentURL.has('type') ? flag?encodeURIComponent(urlParamsFromCurrentURL.get('type')):urlParamsFromCurrentURL.get('type') : '';
    let urlRelease = urlParamsFromCurrentURL.has('release')
        ? flag?encodeURIComponent(urlParamsFromCurrentURL.get('release')):urlParamsFromCurrentURL.get('release')
        : '';
    let urlParamsUpdated = new URLSearchParams(
        urlRelease
            ? 'id=sf.salesforce_help_map.htm&release=238&language=en_US'
            : 'id=sf.salesforce_help_map.htm&language=en_US'
    );

    //VF Links as Canonical
    const knowledgeTypes = ['1', '2', '3'];
    const VFMap = new Map([
        ['1', 'HTViewSolution'],
        ['2', 'HTViewGettingStarted'],
        ['3', 'HTViewQuickStarts'],
        ['5', 'HTViewHelpDoc']
    ]);
    const reverseVFMap = new Map([
        ['HTViewSolution', '1'],
        ['HTViewGettingStarted', '2'],
        ['HTViewQuickStarts', '3'],
        ['HTViewHelpDoc', '5']
    ]);

    if (!urlType && window.location.pathname.includes('apex')) {
        urlType = reverseVFMap.get(window.location.pathname.replace('/apex/', ''));
    }
    if (!urlType) return '';

    if (knowledgeTypes.includes(urlType)) {
        urlParamsUpdated.set('id', urlId);
    } else {
        const hasNoValidPrefix =
            !urlId.startsWith('sf.') && !urlId.startsWith('release-notes.') && !urlId.startsWith('sfdo.');
        urlParamsUpdated.set('id', hasNoValidPrefix ? 'sf.' + urlId : urlId);
    }

    if (urlLanguage) {
        urlParamsUpdated.set('language', urlLanguage);
    }

    if (urlRelease) {
        urlParamsUpdated.set('release', urlRelease);
    }

    if (urlTemplate) {
        const id = urlParamsUpdated.get('id');
        const type = urlType;
        const lang = urlParamsUpdated.get('language');
        let urlTemp = urlTemplate;

        urlTemp = urlRelease ? enforceUrlParameterOrder(urlTemp + '&release=' + urlRelease) : urlTemp;

        return urlTemp.replace('{id}', id).replace('{type}', type).replace('{language}', lang);
    } else {
        return (
            window.location.protocol +
            '//' +
            window.location.hostname +
            '/apex/' +
            VFMap.get(urlType) +
            sortSearchParametersOrder(urlParamsUpdated.toString())
        );
    }
};

const enforceUrlParameterOrder = (url) => {
    let urlObj = new URL(url);

    return urlObj.origin + urlObj.pathname + sortSearchParametersOrder(urlObj.search.slice(1));
};

const sortSearchParametersOrder = (searchParams) => {
    const PARAM_SORT_ORDER = {
        id: 0,
        language: 1,
        mode: 2,
        release: 3,
        type: 4
    };
    let sortedURL = '';
    let params;

    if (searchParams) {
        params = searchParams.split('&');
        params.sort((param1, param2) => {
            if (PARAM_SORT_ORDER[param1.split('=')[0]] > PARAM_SORT_ORDER[param2.split('=')[0]]) return 1;
            if (PARAM_SORT_ORDER[param1.split('=')[0]] === PARAM_SORT_ORDER[param2.split('=')[0]]) return 0;
            if (PARAM_SORT_ORDER[param1.split('=')[0]] < PARAM_SORT_ORDER[param2.split('=')[0]]) return -1;
        });

        sortedURL = '?';
        for (let i = 0; i < params.length; i++) {
            sortedURL += i === params.length - 1 ? params[i] : params[i] + '&';
        }
    }

    return sortedURL;
};

const addNoIndex = function () {
    let currentUrl = new URL(window.location.href);
    //Add noindex for thai language
    if (document.querySelector("meta[content='noindex,nofollow']") == null) {
        if (currentUrl.searchParams.get('language') && currentUrl.searchParams.get('language') === 'th') {
            let meta = document.createElement('meta');
            meta.setAttribute('name', 'robots');
            meta.setAttribute('content', 'noindex,nofollow');
            document.head.appendChild(meta);
        }
    }
};

const handleSEOTags = function (event) {
    currentLanguage = getCommunityLang(event.detail.articleViewerState.language);
    if (urlTemplate) {
        handleSeoTagsByTemplate(event.detail);
    } else {
        handleSeoTagsByCurrentUrl();
    }
    if (event.detail.metaTags) {
        addContentMetaTags(event.detail.metaTags);
    }
    addTheArticleDescription(event);
    addNoIndex();
};

const addContentMetaTags = function (metaTags) {
    for (let tag of metaTags) {
        let tagElement = document.createElement('template');
        tagElement.innerHTML = tag.trim();
        document.head.appendChild(tagElement.content.children[0]);
    }
};

const handleSeoTagsByCurrentUrl = function () {
    let currentUrl = new URL(window.location.href);
    //Create a canonical tag and correct the order
    if (document.querySelector("link[rel='canonical']") == null) {
        let link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        let updatedValue = getModifiedURL(currentUrl.href);
        if (updatedValue) {
            link.setAttribute('href', updatedValue);
            document.head.appendChild(link);
        }
    } else {
        let link = document.querySelector("link[rel='canonical']");
        let updatedValue = getModifiedURL(currentUrl.href);
        if (updatedValue) {
            link.setAttribute('href', updatedValue);
        }
    }
};

const handleSeoTagsByTemplate = function (eventData) {
    const currentURL = new URL(window.location.href);
    let cannonicalHref = '';

    if (urlTemplate) {
        const id = eventData.articleViewerState.topicIdFormatted;
        const type = flag?encodeURIComponent(currentURL.searchParams.get('type')):currentURL.searchParams.get('type');
        const lang = getCommunityLang(eventData.articleViewerState.language);
        const release = currentURL.searchParams.has('release')
            ? flag?encodeURIComponent(currentURL.searchParams.get('release')):currentURL.searchParams.get('release')
            : '';

        let urlTemp = urlTemplate;

        urlTemp = release ? enforceUrlParameterOrder(urlTemp + '&release=' + release) : urlTemp;

        cannonicalHref = urlTemp.replace('{id}', id).replace('{type}', type).replace('{language}', lang);
    }

    //Create a canonical tag and correct the order
    if (document.querySelector("link[rel='canonical']") == null) {
        let link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        if (cannonicalHref) {
            link.setAttribute('href', cannonicalHref);
            document.head.appendChild(link);
        }
    } else {
        let link = document.querySelector("link[rel='canonical']");
        if (cannonicalHref) {
            link.setAttribute('href', cannonicalHref);
        }
    }
};

const addTheArticleDescription = function (event) {
    if (document.querySelector("meta[name='description']") == null) {
        const meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        if (event) {
            meta.setAttribute('content', event.detail.articleViewerState.description);
            document.head.appendChild(meta);
        }
    } else {
        const meta = document.querySelector("meta[name='description']");
        if (event) {
            meta.setAttribute('content', event.detail.articleViewerState.description);
        }
    }
};

/* Hreflangs logic */
function removeNonExistingHrefLangs(event) {
    if (event && event.detail) {
        const languages = event.detail.availableLanguages;
        if (languages && languages.length > 1) {
            let allHreflangTags = document.querySelectorAll('link[hreflang]');
            allHreflangTags.forEach(function (hrefelem) {
                hrefelem.remove();
            });
            createHreflangLinks(languages);
        }
    }
}

function createHreflangLinks(langArr) {
    if (langArr && langArr.length > 0) {
        let shortLangs = [];
        langArr.forEach((lang) => {
            shortLangs.push(lang.slice(0, 2));
            let hrefString = getCurrentHrefByTemplateWithNoLang()
                ? getCurrentHrefByTemplateWithNoLang().replace('{language}', getCommunityLang(lang))
                : null;
            if (hrefString) {
                if (lang.slice(0, 2) === 'en') {
                    let hrefLangEl = document.createElement('link');
                    hrefLangEl.setAttribute('href', hrefString);
                    hrefLangEl.setAttribute('rel', 'alternate');
                    hrefLangEl.setAttribute('hreflang', 'x-default');
                    document.head.appendChild(hrefLangEl);
                }

                let hrefLangEl = document.createElement('link');
                hrefLangEl.setAttribute('href', hrefString);
                hrefLangEl.setAttribute('rel', 'alternate');
                hrefLangEl.setAttribute('hreflang', lang.replace('_', '-'));
                document.head.appendChild(hrefLangEl);
            }
        });
    }
}

function getCurrentHrefByTemplateWithNoLang() {
    let urlValue = new URL(location.href).searchParams;
    if (urlTemplate) {
        const id = flag?encodeURIComponent(urlValue.get('id')):urlValue.get('id');
        const type = flag?encodeURIComponent(urlValue.get('type')):urlValue.get('type');
        return urlTemplate.replace('{id}', id).replace('{type}', type);
    }
    return null;
}

function getCommunityLang(language) {
    const langsWithCountry = ['en_us', 'es_mx', 'zh_cn', 'zh_tw', 'pt_br', 'nl_nl'];
    if (language && langsWithCountry.includes(language.toLowerCase())) {
        return language;
    } else {
        return language.slice(0, 2);
    }
}

document.addEventListener('articlestatechaged', function (event) {
    if (event && event.detail && event.detail.isConfigurableSEOTagsEnabled) {
        urlTemplate = event.detail.urlTemplate;
        flag = event?.detail?.flag? event.detail.flag : false;
        handleSEOTags(event);
        removeNonExistingHrefLangs(event);
    } else {
        handleSEOTags(event);
    }
});
