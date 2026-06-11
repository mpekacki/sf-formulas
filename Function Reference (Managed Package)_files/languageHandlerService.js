/**
 * This is a workaround for making a redirect
 * to current user language version for authenticated user
 * @author Vitaly Andruh (CDS)
 */

let ready = function (callback) {
    if (document.readyState !== 'loading') callback();
    else if (document.addEventListener) document.addEventListener('DOMContentLoaded', callback);
};

ready(function () {
    if ($A && $A.get('$SObjectType.CurrentUser.Id')) {
        const supportedLocalesMapping = new Map([
            ['pt_br', 'pt_BR'],
            ['en_au', 'en_US'],
            ['en_us', 'en_US'],
            ['zh_cn', 'zh_CN'],
            ['en_gb', 'en_GB'],
            ['zh_tw', 'zh_TW'],
            ['nl_nl', 'nl_NL'],
            ['es_mx', 'es_MX'],
            ['zh_sg', 'zh_CN'],
            ['zh_hk', 'zh_TW'],
            ['nl_be', 'nl_NL'],
            ['fr_be', 'fr'],
            ['fr_ca', 'fr'],
            ['fr_lu', 'fr'],
            ['fr_ch', 'fr'],
            ['de_at', 'de'],
            ['de_be', 'de'],
            ['de_lu', 'de'],
            ['de_ch', 'de'],
            ['it_ch', 'it'],
            ['es_ar', 'es_MX'],
            ['es_bo', 'es_MX'],
            ['es_cl', 'es_MX'],
            ['es_co', 'es_MX'],
            ['es_cr', 'es_MX'],
            ['es_do', 'es_MX'],
            ['es_ec', 'es_MX'],
            ['es_sv', 'es_MX'],
            ['es_gt', 'es_MX'],
            ['es_hn', 'es_MX'],
            ['es_ni', 'es_MX'],
            ['es_pa', 'es_MX'],
            ['es_py', 'es_MX'],
            ['es_pe', 'es_MX'],
            ['es_pr', 'es_MX'],
            ['es_us', 'es_MX'],
            ['es_uy', 'es_MX'],
            ['es_ve', 'es_MX'],
            ['pt_pt', 'pt_BR'],
            ['pt', 'pt_BR']
        ]);
        let currentLangContext = $A.get('$Locale.langLocale');
        let currentUserLang = $A.get('$Locale.userLocaleLang');
        let currentUserCountry = $A.get('$Locale.userLocaleCountry');
        let currentUserLocale = (currentUserLang + (currentUserCountry ? '_' + currentUserCountry : '')).toLowerCase();
        let currentUrl = new URL(window.location.href);

        if (
            currentUrl.searchParams.has('language') &&
            supportedLocalesMapping.has(currentUserLocale) &&
            currentUserLang !== currentLangContext.substring(0, 2)
        ) {
            currentUrl.searchParams.set('language', supportedLocalesMapping.get(currentUserLocale));
            window.location.replace(currentUrl);
        }
    }
});
