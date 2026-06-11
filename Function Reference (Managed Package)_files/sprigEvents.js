'use strict';

const SPRIG_EVENT = {
    SDK_READY: 'sdk.ready',
    SURVEY_APPEARED: 'survey.appeared',
    SURVEY_CLOSED: 'survey.closed',
    SURVEY_DIMENSIONS: 'survey.dimensions',
    SURVEY_FADING_OUT: 'survey.fadingOut',
    SURVEY_HEIGHT: 'survey.height',
    SURVEY_LIFE_CYCLE: 'survey.lifeCycle',
    SURVEY_PRESENTED: 'survey.presented',
    SURVEY_WILL_CLOSE: 'survey.willClose',
    SURVEY_WILL_PRESENT: 'survey.will.present',
    VISITOR_ID_UPDATED: 'visitor.id.updated'
};
const SPRIG_STORAGE_DATA = 'userleap.ids';
const SPRIG_SURVEY_ID_PAYLOAD_KEY = 'survey.id';
const GTAG_VID_VARIABLE = 'userLeap.vId';
const ERROR_MESSAGE = {
    SPRIG_UNDEFINED: 'Sprig is not defined',
    SPRIG_MISSING_DATA: 'Sprig data is missing',
    SPRIG_INVALID_JSON: 'Invalid JSON string',
    SPRIG_VID_NOT_FOUND: 'Visitor ID not found'
};
const SPRIG_EVENT_PAYLOAD = {
    'event': 'custEv_surveyImpression',
    'element_name': 'survey',
    'content_category': 'survey',
    'element_type': 'modal',
    'surveyId': null,
    'visitorId': null
};

(function() {
    try {
        if (!window?.Sprig) throw new Error(ERROR_MESSAGE.SPRIG_UNDEFINED);
        const sprigDataJson = window.localStorage.getItem(SPRIG_STORAGE_DATA);
        if (!sprigDataJson) throw new Error(ERROR_MESSAGE.SPRIG_MISSING_DATA);
        const sprigData = JSON.parse(sprigDataJson);
        if (!sprigData) throw new Error(ERROR_MESSAGE.SPRIG_INVALID_JSON);
        const visitorId = sprigData[window.scriptProps?.u || window.Sprig.appId]?.vid
            || sprigData[Object.keys(sprigData)[0]]?.vid;
        if (!visitorId) throw new Error(ERROR_MESSAGE.SPRIG_VID_NOT_FOUND);
        // Store visitorId as a GA Variable
        window.dataLayer.push({[GTAG_VID_VARIABLE]: visitorId});

        // Spring SDK event handler
        const sprigListener = (evt) => {
            if (!evt) return;

            switch (evt.name) {
                case SPRIG_EVENT.SURVEY_WILL_PRESENT:
                    window.dataLayer.push({
                        ...SPRIG_EVENT_PAYLOAD,
                        surveyId: evt[SPRIG_SURVEY_ID_PAYLOAD_KEY],
                        visitorId
                    });
                    break;
                default:
                    return;
            };
        };

        for (const eventKey of Object.keys(SPRIG_EVENT)) {
            window.Sprig('addListener', SPRIG_EVENT[eventKey], (event) => {
                sprigListener(event);
            });
        }
    } catch (error) {
        console.error('[Sprig event listener]', error);
    }
})();
