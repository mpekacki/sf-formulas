// Temporarily disabling linting rules for sanity and adding a tech debt item to resolve (disable statements should be
// removed as they are fixed): W-17309640

/* eslint-disable default-case */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-multi-spaces */
/* eslint-disable operator-linebreak */
/* eslint-disable object-curly-spacing */
/* eslint-disable space-before-function-paren */
/* eslint-disable no-shadow */
/* eslint-disable no-var */
/* eslint-disable vars-on-top */
/* eslint-disable spaced-comment */
/* eslint-disable quote-props */
/* eslint-disable compat/compat */
/* eslint-disable @lwc/lwc/no-document-query */
/* eslint-disable quotes */
/* eslint-disable @lwc/lwc/no-async-operation */
/* eslint-disable brace-style */
/* eslint-disable semi */
/* eslint-disable no-trailing-spaces */
/* eslint-disable padded-blocks */
/* eslint-disable key-spacing */
/* eslint-disable keyword-spacing */
/* eslint-disable no-undef */
/* eslint-disable prefer-const */
/* eslint-disable max-len */
/* eslint-disable space-before-blocks */

/* global embeddedservice_bootstrap */

const DEMO_AGENT_NAME = 'Emma H.';
/**
 * The time in milliseconds to wait for the hcAsyncConversationStarted event
 * before dispatching the hcAsyncConversationTimedOut event.
 * @type {number}
 */
const ASYNC_CONVERSATION_START_TIMEOUT_MS = 5000;

window.addEventListener('openlivechat', openLiveChat);
window.addEventListener('showlivechatbtn', showLiveChatBtn);
window.addEventListener('hidechat', hideLiveChatBtn);
window.addEventListener('setmessagingcontext', setMessagingContext);
window.addEventListener('startmessaging', startMessaging);
window.addEventListener('unsetmiawfields', unsetMiawFields);
window.addEventListener('onEmbeddedMessagingReady', initMessagingContext);
window.addEventListener('endMessagingSession', handleEndMessagingSession);
window.addEventListener('stepUpEndSession', handlestepUpEndSession);
window.addEventListener('hcAsyncStartConversation', handleAsyncStartConversation);
window.addEventListener('openAgentInlineOnload', openAgentWindowInlineOnload);
window.addEventListener('contextSwitchSuccessful',handleTenantChangeEvent);
window.addEventListener('onEmbeddedMessagingWindowMinimized',handleSessionMinimizeEvent);
window.addEventListener('openAgentChatWindowOnload', openAgentChatWindow);
window.addEventListener('hcMessagingContainerReady', handleMessagingContainerReady); 

// Conversation Started
window.addEventListener(
    'onEmbeddedMessagingConversationStarted',
    handleConversationStarted
);
window.addEventListener('sendASAAutomatedLoginMessage', sendASALoginMessage);

//W-15587044 -GA Integration - Added by Sannith
// Chat View Event
window.addEventListener(
    'onEmbeddedMessagingConversationOpened',
    handleConversationOpened
);
// Chat Start, Attachments Sent, and End Chat using special keywords
window.addEventListener('onEmbeddedMessageSent', handleMessageSent);
// Agent joins and left the chat
window.addEventListener(
    'onEmbeddedMessagingConversationParticipantChanged',
    handleChatParticipantChanged
);
window.addEventListener('onEmbeddedMessagingConversationWindowOpened', sendAgentAvailability);

// when user clicked create case on My cases Page
window.addEventListener('sendASACaseCreationMessage',sendCaseCreationMessage);

//Download Chat Transcript
window.addEventListener(
    'onEmbeddedMessagingTranscriptRequested',
    handleDownloadChatTranscript
);
//End Conversation
window.addEventListener('onEmbeddedMessagingConversationClosed',handleConversationClosed);

// Maximized Conversation
window.addEventListener('onEmbeddedMessagingWindowMaximized', handleConversationMaximized);

window.addEventListener('continueOnAgentforce', handleContinueOnAgentforce);
window.addEventListener('launchAdoptionAgentChat', openAdoptionAgentChat);

window.addEventListener('message', handleMessage);
window.addEventListener('hcHideMiaw', hideMessaging);
window.addEventListener('hideASAChat', hideASAChat);
window.addEventListener('showASAChat', showASAChat);

window.addEventListener('isOptedOutTenant', updateGenAIOptOut);
window.addEventListener('sendAutoMesgSearch', handleOnSavedContext);
window.addEventListener('closeOrgPickerModal', handleCancelOrgSelection);
window.addEventListener('sendGAChatViewEvent', handleDispatchGaEvent);

/**
 * @typedef HcChatDetails - Tracks attributes and state for a MIAW conversation
 * @property {boolean} hasReceivedMessages - indicates if at least one message has been received within the conversation (welcome message, system message, etc.)
 * @property {boolean} hasSentInlineQuery - tracks user input from inline messaging has been sent to conversation
 * @property {boolean} einsteinSearch - indicates if chat was initiated from einstein search answers
 * @property {boolean} gaChatViewSent - indicates if chat view analytics event has been dispatched
 * @property {boolean} gaChatStartSent - indicates if chat start analytics event has been dispatched
 * @property {boolean} gaChatEndedSent - indicates if chat ended analytics event has been dispatched
 */

/**
 * @type HcChatDetails
 */
let chatDetails = {
    hasReceivedMessages: false,
    hasSentInlineQuery: false,
    einsteinSearch: false,
    gaChatViewSent: false,
    proactiveAdoptionAgentClicked: false,
    gaChatStartSent: false,
    gaChatEndedSent: false
}

/**
 * Feature flags within liveChatService. Allows for easier rollback with static resource changes.
 */
const chatFeatureFlags = {
    dynamicWelcomeMessageHandler: true
}

let isChatHidden = false;
let chatBotIntentLabel;
let buttonValueLetsChat = false;
let buttonValueASA = false;
let isAgentOnline = 'isAgentOnline';
let hcChatInitiatedFrom = 'footer modal';
const ATTACHMENT_TYPE = 'Attachments';
let isChatStarted = false;
let isuserGptOptOut = false;
const MESSAGING_ONGOING = 'isMessagingSessionOngoing';
const HIDE_ASA_AGENT_WELCOME_MSG = 'hideASAAgentWelcomeMsg';
const CHAT_INITIATOR_HERO_PROMPT_BAR = 'heroPromptBar';
const CHAT_INITIATOR_PROACTIVE_ADOPTION_AGENT_CTA = 'proactiveAdoptionAgentCta';

let query; //variable to store user query that will be sent to the conversation in inline mode after agent's first msg is sent
let agentInitialMessage; //variable to store agent's first msg
let receivedMessage = false;
let hcMessagingContainerElement = null; //variable to store the messaging container element reference from LWC

let isCreateCaseAutoMsgEnabledForCard = false;

/**
 * Handler for messaging container ready event from LWC
 * Stores the element reference for later use when initializing MIAW
 * @param {CustomEvent} event - Event containing the messaging container element reference
 */
function handleMessagingContainerReady(event) {
    if (event.detail && event.detail.element) {
        hcMessagingContainerElement = event.detail.element;
    }
}

function openLiveChat(event) {
    let chatButton = document.querySelector(
        '.embeddedServiceHelpButton button'
    );
    try {
        if (typeof embedded_svc !== 'undefined') {
            let chatEvent = new CustomEvent('chatStatusUpdate', {
                detail: {
                    name: 'chatStatus',
                    value: embedded_svc.settings.agentAvailableOnButtonClick
                }
            });
            window.dispatchEvent(chatEvent);
        }
        if (
            sessionStorage.getItem(isAgentOnline) === 'true' &&
            event.detail?.googleAnalyticsEvent !== undefined
        ) {
            dataLayer.push(event.detail.googleAnalyticsEvent);
        }
    } catch (e) {}
    if (chatButton) {
        saveChannelRecsData(event);
        chatButton.setAttribute('fromcode', 'yes');
        sessionStorage.setItem('isCustomChatBtn', true);
        chatButton.click();
        dataLayer.push({
            event: 'custev_chatview',
            authenticated: true,
            chatLocation: 'orgs page',
            chatExperience: 'agent chat'
        });
    }
}

function saveChannelRecsData(event) {
    if (event.detail && event.detail.data) {
        hcChatInitiatedFrom = 'channel rec';
        sessionStorage.setItem('chat_case', JSON.stringify(event.detail.data));
    } else {
        hcChatInitiatedFrom = 'Live Chat from Contact Support Page';
    }
}

function getHcChatLocation() {
    const result = hcChatInitiatedFrom;
    //reset value
    hcChatInitiatedFrom = 'footer modal';

    return result;
}

function hideLiveChatBtn() {
    let sharedContent = document.querySelector('.ht-shared-content');

    if (sharedContent && sharedContent.firstChild) {
        showLiveChatBtn.chatbotEL = sharedContent.firstChild;
        showLiveChatBtn.chatbotEL.remove();
        isChatHidden = true;
    } else if (!isChatHidden) {
        setTimeout(hideLiveChatBtn, 500);
    }
}

function showLiveChatBtn(event) {
    let sharedContent = document.querySelector('.ht-shared-content');
    embedded_svc.settings.extraPrechatFormDetails =
        event.detail.extraPrechatFormDetails;

    if (sharedContent && showLiveChatBtn.chatbotEL) {
        sharedContent.style.visibility = 'unset';
        sharedContent.appendChild(showLiveChatBtn.chatbotEL);
        isChatHidden = false;
        chatBotIntentLabel =
            event.detail.extraPrechatFormDetails[0].value.replace('-', '/');

        let chatButton = document.querySelector(
            '.embeddedServiceHelpButton button'
        );
        if (chatButton) {
            chatButton.addEventListener('click', () =>
                window.dispatchEvent(new CustomEvent('chatopened'))
            );
        }

        if (
            showLiveChatBtn.chatbotEL.querySelector('.embeddedServiceSidebar')
        ) {
            embedded_svc.liveAgentAPI.endChat();
        }

        showLiveChatBtn.chatbotEL = null;
    }
}

window.addEventListener('load', () => {
    let pageURl = encodeURI(window.location.href);
    if (pageURl.indexOf('/case-submission') > -1) {
        return;
    }
    var startTime = new Date().getTime();
    var interval = setInterval(function () {
        if (new Date().getTime() - startTime > 20000) {
            clearInterval(interval);
            return;
        }
        if (typeof embedded_svc !== 'undefined') {
            const foundLiveAgentApi = embedded_svc.liveAgentAPI;
            if (foundLiveAgentApi) {
                let chatWindow = document.querySelector(
                    '.embeddedServiceSidebar'
                );
                if (chatWindow) {
                    let button = chatWindow.querySelector('.closeButton');
                    if (button) {
                        setTimeout(() => {
                            clearInterval(interval);
                            button.click();
                        }, '750');
                    }
                }
            }
        }
    }, 1000);
});

window.addEventListener('load', () => {
    if (!location.href.includes('case-submission')) {
        var startTime = new Date().getTime();
        var onAvailabilitySet = false;
        var interval = setInterval(function () {
            if (new Date().getTime() - startTime > 20000 || onAvailabilitySet) {
                clearInterval(interval);
                return;
            }
            if (
                typeof embedded_svc !== 'undefined' &&
                embedded_svc.liveAgentAPI
            ) {
                onAvailabilitySet = processAvailability(
                    isAgentOnline,
                    onAvailabilitySet
                );
            }
        }, 1000);
    }
});

function processAvailability(isAgentOnline, onAvailabilitySet) {
    let wasSupportAgentOnline =
        sessionStorage.getItem(isAgentOnline) === 'true';
    let chatButton = document.querySelector(
        '.embeddedServiceHelpButton button'
    );
    let parentHiddenDiv = document.querySelector('.ht-chat-disabled');
    let isButtonHidden = document.querySelector(
        '.embeddedServiceHelpButton.hidden'
    );
    let isSupportAgentOnline =
        chatButton &&
        chatButton.ariaLabel == "Let's Chat" &&
        !parentHiddenDiv &&
        !isButtonHidden;
    if (isSupportAgentOnline) {
        pushChatPromtData();
    }
    if (
        wasSupportAgentOnline !== isSupportAgentOnline ||
        sessionStorage.getItem(isAgentOnline) === null
    ) {
        sessionStorage.setItem(isAgentOnline, isSupportAgentOnline);
    }

    return getOnAvailabilitySet(onAvailabilitySet, isAgentOnline);
}

function pushChatPromtData() {
    if (!buttonValueLetsChat) {
        dataLayer.push({
            event: 'custev_chatprompt',
            authenticated: true,
            chatLocation: 'footer modal',
            chatExperience: 'agent chat'
        });
        sessionStorage.setItem(isAgentOnline, true);
        buttonValueLetsChat = true;
    }
}

function getOnAvailabilitySet(onAvailabilitySet, isAgentOnline) {
    if (!onAvailabilitySet) {
        embedded_svc.addEventHandler('onAvailability', function (data) {
            let wasAgentOnlineSaved =
                sessionStorage.getItem(isAgentOnline) === 'true';
            let isAgentOnlineFromData = !!data.isAgentAvailable;
            let chatButton = document.querySelector(
                '.embeddedServiceHelpButton button'
            );
            let isButtonHidden = document.querySelector(
                '.embeddedServiceHelpButton.hidden'
            );

            if (
                chatButton &&
                chatButton.ariaLabel === "Let's Chat" &&
                isAgentOnlineFromData &&
                !wasAgentOnlineSaved &&
                isButtonHidden
            ) {
                dataLayer.push({
                    event: 'custev_chatprompt',
                    authenticated: true,
                    chatLocation: 'footer modal',
                    chatExperience: 'agent chat'
                });
            }
            if (isAgentOnlineFromData !== wasAgentOnlineSaved) {
                sessionStorage.setItem(isAgentOnline, isAgentOnlineFromData);
            }
        });
        onAvailabilitySet = true;
    }
    return onAvailabilitySet;
}

/**
 * Central handler for initiating all async conversations. This function should be used
 * to initiate all async conversations by dispatching the appropriate conversation flow
 * based on the chat initiator type.
 * @param {CustomEvent} event - The custom event containing conversation details
 */
function handleAsyncStartConversation(event){
    dispatchHcAsyncConversationInitiated();

    if (event.detail.chatInitiator === CHAT_INITIATOR_HERO_PROMPT_BAR) {
        openAgentWindowInline(event);
    } else if (event.detail.chatInitiator === CHAT_INITIATOR_PROACTIVE_ADOPTION_AGENT_CTA) {
        handleAdoptionAgent(event);
    }
}

function openAgentWindowInline(event){
    try{
        const embeddedService = window.embeddedservice_bootstrap;
        if(embeddedService && embeddedService.utilAPI){
            query = event.detail.query;
            agentInitialMessage = event.detail.agentInitialMessage;
            embeddedservice_bootstrap.utilAPI.launchChat();
        }
    } catch (e){
        window.dispatchEvent(new CustomEvent('embeddedServiceError'));
        console.error('openAgentWindowInline failed, ', e);
    }
}

function openAgentChatWindow(event){    
    try{
        const embeddedService = window.embeddedservice_bootstrap;
        if(embeddedService && embeddedService.utilAPI){
            // Check if this was initiated from Search with Agentforce button
            if (event?.detail?.source === 'searchWithAgentforce' && isChatBotAsa()) {
                // Set temporary flag since conversation ID doesn't exist yet
                sessionStorage.setItem('searchWithAgentforceFlag', 'true');
                
                embeddedservice_bootstrap.utilAPI
                    .launchChat()
                    .then((e) => {
                        // Chat launched successfully
                    })
                    .catch(function (error) {
                        console.debug("openAgentChatWindow (Search with Agentforce) - Caught error " + error);
                        // Clear flag on error
                        sessionStorage.removeItem('searchWithAgentforceFlag');
                    });
            } else {
                // Default behavior for other sources
                embeddedservice_bootstrap.utilAPI.launchChat();
            }
        }
    } catch (e){
        window.dispatchEvent(new CustomEvent('embeddedServiceError'));
        console.error('openAgentChatWindow failed, ', e);
    }
}

function openAgentWindowInlineOnload(event){
    try{
        let messagingSessionOngoing = sessionStorage.getItem(MESSAGING_ONGOING) === 'true';
        const embeddedService = window.embeddedservice_bootstrap;

        if(messagingSessionOngoing && embeddedService && embeddedService.utilAPI){
            query = event.detail.query;
            agentInitialMessage = event.detail.agentInitialMessage;
            embeddedservice_bootstrap.utilAPI.launchChat();
        }
    } catch (e){
        window.dispatchEvent(new CustomEvent('embeddedServiceError'));
        console.error('openAgentWindowInlineOnload failed, ', e);
    }
}

/**
 * Indicates if active embeddedservice deployment is the inline service agent
 * @return {Boolean}
 */
function isInlineServiceDeployment() {
    return (
        window.embeddedservice_bootstrap?.settings.eswConfigDevName ===
        'Agentforce_Inline_Service_Agent'
    );
}

function initMessagingContext(){
    try{
        window.dispatchEvent(new CustomEvent('initmiawcontext'));
        const embeddedService = window.embeddedservice_bootstrap;
        if(embeddedService){
            embeddedService.settings.hideChatButtonOnLoad = true;

            if (isInlineServiceDeployment()) {
                // configure agentforce inline mode
                // Use the element reference from LWC if available, otherwise fall back to querySelector
                embeddedService.settings.targetElement = hcMessagingContainerElement || document.body.querySelector('.hc-inline-messaging__container');
                embeddedService.settings.enableUserInputForConversationWithBot = false;
            }
            window.dispatchEvent(new CustomEvent('validateASAChat'));
        }
    } catch (e){
        window.dispatchEvent(new CustomEvent('embeddedServiceError'));
        console.error('initMessagingContext failed, ', e);
    }

}

function sendASALoginMessage(){
    embeddedservice_bootstrap.utilAPI.sendTextMessage('Automated message: log in successful');
}

function sendCaseCreationMessage(event){
    sessionStorage.setItem('isAskAgentForceClicked', true); 
    isCreateCaseAutoMsgEnabledForCard = event?.detail?.isCreateCaseAutoMsgEnabled;
    console.log('isCreateCaseAutoMsgEnabledForCard ***'+isCreateCaseAutoMsgEnabledForCard);
    if(sessionStorage.getItem(MESSAGING_ONGOING) === 'true'){
        sessionStorage.setItem('isCreateCaseClicked', true);
    }else{
        sessionStorage.setItem('isCreateCaseClicked', false);
        this.checkAndSendMessage();    
    }  
}

function checkAndSendMessage(){
    // Inline Deployment Check added
    if (isInlineServiceDeployment() && window.embeddedservice_bootstrap && 
        window.embeddedservice_bootstrap.utilAPI) {
            embeddedservice_bootstrap.utilAPI.launchChat();
            sessionStorage.setItem('sendMessageOnceAgentJoined', true);   
    } else {
        setTimeout(checkAndSendMessage, 500);
    }
}


/**
 * Stores active conversation id in session storage for later use upon conversation start
 * @param {Event} event
 */
function handleConversationStarted(event) {
  sessionStorage.setItem(
      'messagingConversationId',
      event.detail.conversationId
  );
    // Retrieve the HIDE_ASA_AGENT_WELCOME_MSG flaf to consider this session invoked from proactive adoption
    const proactiveAdoptionAgentClicked = localStorage.getItem(HIDE_ASA_AGENT_WELCOME_MSG) === 'true';
    // Get the current conversation ID from session storage
    const conversationId = sessionStorage.getItem('messagingConversationId');

    if (conversationId && sessionStorage.getItem(conversationId) === null) {
        const initialState = {
            hasReceivedMessages: false,
            hasSentInlineQuery: false,
            einsteinSearch: false,
            gaChatViewSent: false,
            proactiveAdoptionAgentClicked, // Using shorthand to store whether the adoption agent has been initiated.
            gaChatStartSent: false,
            gaChatEndedSent: false
        };
        sessionStorage.setItem(conversationId, JSON.stringify(initialState));
    }

  // if in inline mode, remove the title on the embedded frame
  if (isInlineServiceDeployment() && document.getElementById('embeddedMessagingFrame')) {
    document.getElementById('embeddedMessagingFrame').title = '';
  }
  // Checking session storage value to determine the chat type
    const chatType = sessionStorage.getItem('chat');
    if (chatType === 'chat') {
    sessionStorage.setItem('channel', 'chat');
     } else {
    sessionStorage.setItem('channel', 'agentforce');
     }

    try {
        chatDetails = JSON.parse(sessionStorage.getItem(sessionStorage.getItem('messagingConversationId')));
        if (isChatBotAsa() && !chatDetails.gaChatViewSent && sessionStorage.getItem('isAskAgentForceClicked') !== 'true' && sessionStorage.getItem('searchWithAgentforceFlag') !== 'true') {
            window.dispatchEvent(new CustomEvent('getMessagingSessionId', {
                detail: {
                    conversationId: event.detail.conversationId,
                    event: 'custev_chatview',
                    chatLocation: isInlineServiceDeployment() ? 'asa immersive' : ( chatDetails?.einsteinSearch ? 'einstein search' : 'footer modal'),
                    chatExperience: 'agentforce service agent'
                }
            })
            );
        }else if(sessionStorage.getItem('isAskAgentForceClicked') === 'true'){
                    sessionStorage.setItem('isAskAgentForceClicked', false);
                    window.dispatchEvent(new CustomEvent('getMessagingSessionId', {
                        detail: {
                            conversationId: event.detail.conversationId,
                            event: 'custev_chatview',
                            chatLocation: 'asa immersive - my cases',
                            chatExperience: 'agentforce service agent'
                        }
            })
            );                    
        }else if(sessionStorage.getItem('searchWithAgentforceFlag') === 'true'){
                    window.dispatchEvent(new CustomEvent('getMessagingSessionId', {
                        detail: {
                            conversationId: event.detail.conversationId,
                            event: 'custev_chatview',
                            chatLocation: 'search with agentforce',
                            chatExperience: 'agentforce service agent'
                        }
            })
            );                    
        }
    } catch (error) {
        console.log('Error getting messaging session id ', error);
    }
}

/**
 * function to dispatch GA events after getting messaging session id
 * @param {Event} event
 */
function handleDispatchGaEvent(event) {
    try{
        chatDetails = JSON.parse(sessionStorage.getItem(sessionStorage.getItem('messagingConversationId')));
        if (isChatBotAsa() && !chatDetails.gaChatViewSent && event.detail.event === 'custev_chatview') {
            dataLayer.push({
                event: event.detail.event,
                chatLocation: event.detail.chatLocation,
                chatExperience: chatDetails.proactiveAdoptionAgentClicked ? 'adoption agent': event.detail.chatExperience,
                LiveChatTranscriptID: event.detail.LiveChatTranscriptID
            });
            chatDetails.gaChatViewSent = true;
        } else if (isChatBotAsa() && !chatDetails.gaChatStartSent && event.detail.event === 'custev_chatstart') {
            dataLayer.push({
                event: event.detail.event,
                chatLocation: event.detail.chatLocation,
                chatExperience: event.detail.chatExperience,
                LiveChatTranscriptID: event.detail.LiveChatTranscriptID
            });
            chatDetails.gaChatStartSent = true;
        }
        sessionStorage.setItem(sessionStorage.getItem('messagingConversationId'), JSON.stringify(chatDetails));
	sessionStorage.setItem('messagingSessionId', event.detail.LiveChatTranscriptID);
    } catch (error) {
        console.log('Error dispatching GA event ', error);
    }
}

/**
 * Handle events to end the messaging conversation session.
 * @param {Event} event
 */
function handleEndMessagingSession(event) {
    closeEmbeddedMessagingConversation(event?.detail?.conversationId, {logout: event?.detail?.logout});
}

/**
 * Handle events to end the messaging conversation session.
 * @param {Event} event
 */
function handlestepUpEndSession(event) {
    sessionStorage.setItem('stepUpEndSession','true');
}

function handleTenantChangeEvent(event){
    if(isOngoingConversationASA() && sessionStorage.getItem(MESSAGING_ONGOING) === 'true'){
        sessionStorage.setItem('TenantChanged','true');
    } 
}

function handleConversationOpened(event) {
    console.log('open conversation'+event.detail.conversationId);
    let hideASAAgentWelcomeMsg = localStorage.getItem(HIDE_ASA_AGENT_WELCOME_MSG) === 'true';
    if (hideASAAgentWelcomeMsg) {
        const chatIframe = document.getElementById("embeddedMessagingFrame");

        if (chatIframe && chatIframe.src) {
            const origin = new URL(chatIframe.src).origin;
            // Send a postMessage to  update the header
            chatIframe.contentWindow.postMessage({
                action: HIDE_ASA_AGENT_WELCOME_MSG,
            }, origin);  
            
        }
    }
    let agentName = sessionStorage.getItem('agentName');
    if(agentName === DEMO_AGENT_NAME){

        // send postMessage so side window header will be updated
        updateHeaderInIframe();

        // Update the header in dynamic component hc-inline-chat-header
        const chatIframe = document.getElementById("embeddedMessagingFrame");
            if (chatIframe && chatIframe.contentWindow) {
                chatIframe.contentWindow.postMessage({
                    action: 'updateHeader', // Action to identify the message type
                    agentName  :  agentName
            }, '*' );
            }
    }
    if(sessionStorage.getItem('stepUpEndSession') && isOngoingConversationASA()) {
        hideASAChat();
        closeEmbeddedMessagingConversation(event.detail.conversationId);
        sessionStorage.removeItem('stepUpEndSession');
        return;
    }
    if (isChatBotAsa() && event.detail.conversationId) {
        window.dispatchEvent(new CustomEvent('asachatopened', { detail: {result: 'success'} }));
    }

    if(isOngoingConversationASA() && isuserGptOptOut && event.detail.conversationId){
        hideASAChat();
        window.dispatchEvent(new CustomEvent('showGenAIToast'));
        closeEmbeddedMessagingConversation(event.detail.conversationId);
        sessionStorage.setItem(MESSAGING_ONGOING, false);
        sessionStorage.setItem('messagingConversationId', '');
    } else {
        // Event to handle the session upgrade
        window.dispatchEvent(
            new CustomEvent('upgradeSession', {
                detail: { conversationId: event.detail.conversationId }
            })
        );

        embeddedservice_bootstrap.prechatAPI.unsetVisiblePrechatFields(['pageUri']);
        sessionStorage.setItem(MESSAGING_ONGOING, true);
        console.log('handleConversationOpened - true ');
        if(isDemoModeEnabled()){
            window.dispatchEvent(
                new CustomEvent('enableDemoMode', {
                    detail: {
                        conversationId: event.detail.conversationId
                    }
                })
            );
        }
    }

    if(isOngoingConversationASA() && sessionStorage.getItem('TenantChanged')){
        sessionStorage.removeItem('TenantChanged'); 
        setTimeout(()=>{
        embeddedservice_bootstrap.utilAPI.sendTextMessage('Automated message: Tenant Id Changed.');
        },3000);
    }
    if(sessionStorage.getItem('isCreateCaseClicked') === 'true'){
        setTimeout(()=>{
        if (isCreateCaseAutoMsgEnabledForCard) {
            embeddedservice_bootstrap.utilAPI.sendTextMessage('Create a Case');
        }
        sessionStorage.setItem('isCreateCaseClicked', false);
        
    },3000);
    }
}

function isDemoModeEnabled(){
    let urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('d') && urlParams.get('d') == '1';
}

/**
 * Persist chat details object to session storage
 * @param {HcChatDetails} details 
 * @returns 
 */
function saveChatDetails(details) {
    if (!details) {
        return;
    }

    try {
        sessionStorage.setItem(
            sessionStorage.getItem('messagingConversationId'),
            JSON.stringify(chatDetails)
        );
    } catch (e) {
        console.error('Error saving chat details: ' + e);
    }
}

/**
 * Get chat details from session storage
 * @returns {HcChatDetails}
 */
function getChatDetails() {
  try {
    return JSON.parse(sessionStorage.getItem(sessionStorage.getItem('messagingConversationId')));
  } catch (e) {
    console.error('Error getting chat details: ' + e);
    return {};
  }
}

function handleMessageSent(event) {
    chatDetails = getChatDetails();
    if (!chatDetails?.hasReceivedMessages) {
      chatDetails.hasReceivedMessages = true;
      saveChatDetails(chatDetails);
    }

    receivedMessage = true;

    window.dispatchEvent(
        new CustomEvent('checkForASAEvents', {
            detail: {
                conversationId: event.detail.conversationId,
                chatLocation: sessionStorage.getItem('searchWithAgentforceFlag') === 'true'
                    ? 'search with agentforce'
                    : isInlineServiceDeployment()
                    ? 'asa immersive'
                    : chatDetails?.einsteinSearch
                    ? 'einstein search'
                    : 'footer modal'
            }
        })
    );
    if (!isChatBotAsa()) {
        // Checking if the page is not ASA - assuming Miaw
        const msId = event.detail.conversationEntry.relatedRecords[0];

        let payload = event.detail.conversationEntry.entryPayload;
        let jsonData = JSON.parse(payload);
        let formatType = jsonData.abstractMessage.staticContent.formatType;
        let textMsg = jsonData.abstractMessage.staticContent.text;
        textMsg = textMsg?.toLowerCase();

        if (formatType === ATTACHMENT_TYPE) {
            dataLayer.push({
                event: 'custEv_contentClick',
                click_text: 'attach files icon',
                content_category: 'miaw',
                element_type: 'button',
                element_title: 'attach files'
            });
        } else if (
            textMsg === 'stop chat' ||
            textMsg === 'end chat' ||
            textMsg === 'close chat' ||
            textMsg === 'cancel chat' ||
            textMsg === 'quit chat'

        ) {
            dataLayer.push({
                event: 'custev_chatclose',
                chatLocation: 'channel rec',
                chatExperience: 'miaw',
                chatCloseClick: 'user keyword - ' + textMsg
            });
            // Making this boolean as false when the user enters the chat close keywords.
            isChatStarted = false;
        } else if (msId != null && !isChatStarted) {
            isChatStarted = true; // Restricting this event to fire only once
            dataLayer.push({
                event: 'custev_chatstart',
                chatLocation: 'channel rec',
                chatExperience: 'miaw',
                LiveChatTransciptID: msId
            });
        }
    } else {
        try {
            let chatDetails = getChatDetails();
            const messageText = JSON.parse(event?.detail?.conversationEntry?.entryPayload || '{}')?.abstractMessage?.staticContent?.text || '';
            if (
                !chatDetails?.gaChatStartSent && 
                !isAgentforceAgent(event.detail?.conversationEntry?.senderDisplayName) && 
                event.detail?.conversationEntry?.senderDisplayName !== 'Automated Process' &&
                !messageText.toLowerCase().includes('automated message')
            ) {
                window.dispatchEvent(
                    new CustomEvent('getMessagingSessionId', {
                        detail: {
                            conversationId: event.detail.conversationId,
                            event: 'custev_chatstart',
                            chatLocation: sessionStorage.getItem('searchWithAgentforceFlag') === 'true'
                                ? 'search with agentforce'
                                : isInlineServiceDeployment()
                                ? 'asa immersive'
                                : chatDetails?.einsteinSearch 
                                ? 'einstein search'
                                : 'footer modal',
                            chatExperience: 'agentforce service agent'
                        }
                    })
                );
            }
            if (isInlineServiceDeployment()) {
                if (chatFeatureFlags?.dynamicWelcomeMessageHandler) {
                    sendInlineUserQueryDynamicMessage(event);
                } else {
                    sendInlineUserQueryStaticMessage(event);
                }
            }
        } catch (e) {
            window.dispatchEvent(new CustomEvent('embeddedServiceError'));
            console.error('handleMessageSent failed, ', e);
        }
    }
}

/**
 * Send inline user query to conversation when static welcome message is received.
 * @param {Event} event - MIAW onEmbeddedMessageSent event
 */
function sendInlineUserQueryStaticMessage(event) {
    try {
        const conversationMessageEntry = JSON.parse(
            event.detail.conversationEntry.entryPayload
        );
        if (
            conversationMessageEntry.entryType === 'Message' &&
            conversationMessageEntry.abstractMessage.messageType ===
                'StaticContentMessage'
        ) {
            if (
                conversationMessageEntry.abstractMessage.staticContent
                    .formatType === 'Text'
            ) {
                if (
                    query &&
                    agentInitialMessage !== null &&
                    agentInitialMessage !== query &&
                    (conversationMessageEntry.abstractMessage.staticContent.text.includes(
                        agentInitialMessage?.trim()
                    ) ||
                        conversationMessageEntry.abstractMessage.staticContent
                            .text === agentInitialMessage?.trim())
                ) {
                    embeddedservice_bootstrap.utilAPI.sendTextMessage(query);
                    query = '';
                }
            }
        }
    } catch (error) {
        console.error('Error sending inline user query', error);
        window.dispatchEvent(new CustomEvent('embeddedServiceError'));
    }
}

/**
 * Send inline user query to conversation when conversation is eligible.
 * Note: Agentforce welcome messages for non-english users are dynamically 
 * translated so assumptions are made that the message can be inserted.
 * @param {Event} event - MIAW onEmbeddedMessageSent event
 */
function sendInlineUserQueryDynamicMessage(event) {
    try {
        const details = getChatDetails();

        if (
            !query ||
            !details?.hasReceivedMessages ||
            details?.hasSentInlineQuery
        ) {
            return;
        }

        if (!isAgentforceAgent(event?.detail?.conversationEntry?.senderDisplayName)) {
            return;
        }

        embeddedservice_bootstrap?.utilAPI?.sendTextMessage(query);
        query = null;
        details.hasSentInlineQuery = true;
        saveChatDetails(details);
    } catch (error) {
        console.error('Error sending inline user query', error);
        window.dispatchEvent(new CustomEvent('embeddedServiceError'));
    }
}

function updateHeaderInIframe() {
    console.log('updateHeaaderInframe called');
    const chatIframe = document.getElementById("embeddedMessagingFrame");

    if (chatIframe) {
        // Send a postMessage to  update the header
        chatIframe.contentWindow.postMessage({
            action: 'updateHeaderInSideWindow',
        }, '*');  
        
    }
}
function handleChatParticipantChanged(event) {
    console.log("onEmbeddedMessagingConversationParticipantChanged Event:", event.detail);

    try {
        const payload = JSON.parse(event.detail.conversationEntry.entryPayload);
        let isParticipantEngineer = false;
        let enableFileUploadIcon = false;
        let agentName = payload.entries[0].displayName;
        let engineerLeftChat = false;
        sessionStorage.setItem('agentName',agentName);
        if(agentName === DEMO_AGENT_NAME){ 
            updateHeaderInIframe();
        } 

        if (payload.entries?.length > 0) {
            for (const entry of payload.entries) {
                const participant = entry.participant;
                const operationValue = entry.operation;

                // If Chat is 'Automatedprocess', file upload is always disabled
                if (participant.appType === "conversation") {
                    isParticipantEngineer = false;
                    break;
                }

                // Enabling file upload only if an agent is present
                if (participant.appType === "agent") {
                    isParticipantEngineer = true;
                }

                // If agent disconnects (operation: remove), disabling file upload
                if (operationValue === "remove" && participant.appType === "agent") {
                    isParticipantEngineer = false;
                    engineerLeftChat = true;
                }
            }
        }

        sessionStorage.setItem("isParticipantEngineer", JSON.stringify(isParticipantEngineer));
        console.log("Updated agent availability in session:", isParticipantEngineer);

        const operationValue = payload.entries?.[0]?.operation;
        if (!isOngoingConversationASA()) {

            if (operationValue === "add") {
                dataLayer.push({
                    event: "custev_chatinitialization",
                    chatLocation: "channel rec",
                    chatExperience: "miaw"
                });
            }
            if (operationValue === "remove") {
                dataLayer.push({
                    event: "custev_chatended",
                    chatEndedBy: "agent",
                    chatLocation: "channel rec",
                    chatExperience: "miaw"
                });

                isChatStarted = false;
            }
        } else if (isOngoingConversationASA()) {
            chatDetails = getChatDetails();
            if (operationValue === "remove" && !chatDetails?.gaChatEndedSent && engineerLeftChat) {
                dispatchChatEndedGaEvent('agent');
                engineerLeftChat = false;
            }
        
            if (operationValue === "add" && isParticipantEngineer) {
                chatDetails = getChatDetails();
                window.dispatchEvent(
                    new CustomEvent('checkForASAEvents', {
                        detail: {
                            conversationId: event.detail.conversationId,
                            chatLocation: sessionStorage.getItem('searchWithAgentforceFlag') === 'true'
                                ? 'search with agentforce'
                                : isInlineServiceDeployment()
                                ? 'asa immersive'
                                : chatDetails?.einsteinSearch
                                ? 'einstein search'
                                : 'footer modal'
                        }
                    })
                );
            }
        } 


        // Send updated state to the iframe
        const chatIframe = document.getElementById("embeddedMessagingFrame");
        if (chatIframe && chatIframe.contentWindow) {
            const messagePayload = { event: "enableFileUpload", enableFileUploadIcon: isParticipantEngineer };            
            console.log("Sending message to iframe:", messagePayload);               
            chatIframe.contentWindow.postMessage(messagePayload, "*");
        }
        if(sessionStorage.getItem('sendMessageOnceAgentJoined') === 'true'){
            setTimeout(()=>{
                if (isCreateCaseAutoMsgEnabledForCard) {
                    embeddedservice_bootstrap.utilAPI.sendTextMessage('Create a Case');
                }
                sessionStorage.setItem('sendMessageOnceAgentJoined', false);
                
            },3000);            
        }
    } catch (error) {
        console.error("Error processing participant change event:", error);
    }
}

function sendAgentAvailability() {
    console.log('checking store agent onAvailability');

    //get the session stored agent onAvailability
    const isParticipantEngineer =  JSON.parse(sessionStorage.getItem("isParticipantEngineer") || "false");
    const chatIframe = document.getElementById("embeddedMessagingFrame");

    if (chatIframe && chatIframe.contentWindow) {
        chatIframe.contentWindow.postMessage(
            { event: "enableFileUpload", enableFileUploadIcon: isParticipantEngineer },"*" );     
        console.log("Agent availability sent to iframe on the chat window load change:", isParticipantEngineer);    
    } else {  
        console.warn("Chat iframe not found. File upload remains disabled.");    
    } 
}

function handleDownloadChatTranscript(event) {
    if (!isChatBotAsa()) {
        // Checking if the page is not ASA - assuming Miaw
        dataLayer.push({
            event: 'custev_chatclose',
            chatLocation: 'channel rec',
            chatExperience: 'miaw',
            chatCloseClick: 'Download chat transcript'
        });
    }
}

function handleConversationClosed(event) {
    if (!isChatBotAsa()) {
        // Checking if the page is not ASA - assuming Miaw
        dataLayer.push({
            event: 'custev_chatclose',
            chatLocation: 'channel rec',
            chatExperience: 'miaw',
            chatCloseClick: 'End conversation'
        });
        // Making this boolean as false when the conversation ends. It helps in firing the chat start event when the live chat tile clicks from same page
        isChatStarted = false;
    }
    chatDetails = getChatDetails();
    if (!chatDetails?.gaChatEndedSent) {
        dispatchChatEndedGaEvent('user');
    }
    sessionStorage.removeItem('chat');
    sessionStorage.setItem(MESSAGING_ONGOING, false);
    console.log('handleConversationOpened - false ');  
    sessionStorage.setItem("isParticipantEngineer", false);  
    const chatIframe = document.getElementById("embeddedMessagingFrame"); 
    if (chatIframe && chatIframe.contentWindow) {
        const messagePayload = { event: "enableFileUpload", enableFileUploadIcon: false };            
        chatIframe.contentWindow.postMessage(messagePayload, "*");
    }
    window.dispatchEvent(new CustomEvent('conversationClosed', {}));
    if(isOngoingConversationASA() || window.location.pathname === '/s/' || window.location.pathname === '/s'){
        window.dispatchEvent(new CustomEvent('endMessagingSession'));
    }
    receivedMessage = false;

    resetInlineExperience();
}

/**
 * Dispatches a GA event when the chat ends.
 * @param {string} chatEndedBy - Indicates who ended the chat, either 'user' or 'agent'.
 */
function dispatchChatEndedGaEvent (chatEndedBy) {
    chatDetails = getChatDetails();
	dataLayer.push({
		event: 'custev_chatended',
		chatEndedBy: chatEndedBy,
		chatLocation: isInlineServiceDeployment() ? 'asa immersive' : (chatDetails?.einsteinSearch ? 'einstein search' : 'footer modal'),
		chatExperience: 'agentforce service agent'
	});
    if (chatDetails) {
        chatDetails.gaChatEndedSent = true;
        saveChatDetails(chatDetails);
    }
}

/**
 * Handle the event when the conversation is maximized.
 * One feature of this is to remove the inert attr when chat is maximized
 * as this prevents the user from interacting with the navigation components.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert
 */
function handleConversationMaximized (event) {
    // find the nav wrapper
    const el = document.querySelector('#c360-wrapper');
    if (!!el) { // if found
        // check if this tag itself has the inert attribute as it *should* be the top-level
        if (el.attributes['inert']) { // check for the atttribute
            el.removeAttribute('inert'); // remove attribute
        } else { // if not check one level up as the original impl had a wrapping div
            const p = el.parentNode;
            if (!!p && p.attributes['inert']) { // make sure we have an element
                p.removeAttribute('inert'); // remove attribute
            }
        }
    }
}

/**
 * Reset inline experience configuration and page.
 */
function resetInlineExperience() {
    if (!isInlineServiceDeployment()) {
        return;
    }

    // ensure prompt input is visible to user due to certain device types (iOS)
    // leaving users at the bottom of the page when conversations are closed
    setTimeout(()=> {
      window.scrollTo(0, 0);
    }, 100)
}

function setMessagingContext(event) {
    const payload = event.detail;
    const embeddedService = window.embeddedservice_bootstrap;
    if (embeddedService && embeddedService.prechatAPI) {
        // Set customer context data for miaw
        if (payload && payload.hiddenFields) {
            embeddedservice_bootstrap.prechatAPI.setHiddenPrechatFields(
                payload.hiddenFields
            );
        }

        if( (!sessionStorage.getItem(MESSAGING_ONGOING) ||
            sessionStorage.getItem(MESSAGING_ONGOING) == 'false') &&
            isChatBotAsa()){
            payload['fields'] =  {
                pageUri: {
                    value: window.location.pathname,
                    isEditableByEndUser: false
                }
            };
        }

        // Set customer input data for miaw
        if (payload && payload.fields) {
            embeddedservice_bootstrap.prechatAPI.setVisiblePrechatFields(
                payload.fields
            );
        }
    } else {
        setTimeout(() => {
            setMessagingContext(event);
        }, 500);
    }
}

async function startMessaging() {
    const embeddedService = window.embeddedservice_bootstrap;

    if (embeddedService && embeddedService.utilAPI) {
        embeddedservice_bootstrap.utilAPI
            .launchChat()
            .then(() => {
                // Storing "chat" in session storage. this function gets executed only for MIAW
                sessionStorage.setItem('chat', 'chat');
                window.dispatchEvent(
                    new CustomEvent('chatopened', {
                        detail: { result: 'success' }
                    })
                );
                //W-15587044 -- Whenever the Miaw Chat window is opened, we are sending an event to data layer.
                dataLayer.push({
                    event: 'custev_chatview',
                    chatLocation: 'channel rec',
                    chatExperience: 'miaw'
                });
            })
            .catch(() => {
                window.dispatchEvent(
                    new CustomEvent('chatopened', {
                        detail: { result: 'failed' }
                    })
                );
            });
    } else {
        console.error('embeddedservice_bootstrap not loaded');
    }
}

function unsetMiawFields(event) {
    const payload = event.detail;
    if (payload && payload.fields) {
        setTimeout(() => {
            embeddedservice_bootstrap.prechatAPI.unsetVisiblePrechatFields(
                payload.fields
            );
        }, 500);
    }
}

function handleMessage(event) {
    if (event.data && event.origin) {
        switch (event.data.method) {
            case 'HC_PAGE_RELOAD':
                if (location.href.includes('/support')) {
                    window.dispatchEvent(new CustomEvent('reloadchannelrecs'));
                }
                break;
        }
    }
}

function hideMessaging(event, counter) {
    if (isInlineServiceDeployment()) {
        return;
    }
    const messagingInProgressFrame = document.querySelector(
        '.embeddedMessagingFrame'
    );

    if (!counter) {
        counter = 0;
    }

    if (messagingInProgressFrame) {
        if (!isChatBotAsa()) {
            messagingInProgressFrame.remove();
        }
    } else if (!messagingInProgressFrame && counter < 30) {
        setTimeout(() => {
            messagingInProgressFrame(event, counter + 1);
        }, 1000);
    }
}

function verifyInProgressChats() {
    const liveChatInProgressFrame = document.querySelector(
        '.embeddedServiceSidebar'
    );
    const liveChatWidget = document.querySelector(
        'div:has(>.embeddedServiceHelpButton)'
    );
    const messagingInProgressFrame = document.querySelector(
        '.embeddedMessagingFrame'
    );

    window.dispatchEvent(
        new CustomEvent('chatsInProgress', {
            detail: {
                inProgress: liveChatInProgressFrame || messagingInProgressFrame
            }
        })
    );

    if (
        messagingInProgressFrame &&
        liveChatWidget &&
        liveChatWidget.style.display !== 'none'
    ) {
        liveChatWidget.style.display = 'none';
    } else if (
        !messagingInProgressFrame &&
        liveChatWidget &&
        liveChatWidget.style.display === 'none'
    ) {
        liveChatWidget.style.display = 'block';
    }
}

function isChatBotAsa() {
    const iframe = document.querySelector('#embeddedMessagingSiteContextFrame');
    if (iframe) {
        const iframeSrc = iframe.getAttribute('src').toLowerCase();
        if (
            iframeSrc &&
            (iframeSrc.includes('copilot') || iframeSrc.includes('agentforce'))
        ) {
            return true;
        }
    }
    return false;
}

function isOngoingConversationASA(){
    return sessionStorage.getItem('channel') == 'agentforce';
}

function hideASAChat() {
    if (!isOngoingConversationASA()) return;
    const asaElement = document.querySelector(
        '.embeddedMessagingConversationButtonWrapper'
    );
    if (asaElement) {
        asaElement.style.display = 'none';
    }
    const messagingInProgressFrame = document.querySelector(
        '.embeddedMessagingFrame'
    );
    if (messagingInProgressFrame) {
        messagingInProgressFrame.style.display = 'none';
    }
}

function handleSessionMinimizeEvent() {
    window.dispatchEvent(
        new CustomEvent('hcConversationMinimized')
    );
}

function showASAChat() {
    // Get the current URL and return control if it is a support page
    if (window.location.pathname.startsWith('/s/support')) {
        return;
    }
    const embeddedService = window.embeddedservice_bootstrap;
    if (embeddedService && embeddedService.utilAPI) {
        window.embeddedservice_bootstrap.utilAPI.showChatButton();

        if (!buttonValueASA) {
            dataLayer.push({
                event: 'custev_chatprompt',
                chatLocation: 'footer modal',
                chatExperience: 'agentforce service agent'
            });

            buttonValueASA = true;
        }
    }
}

function updateGenAIOptOut(event) {
    const activeConversationId = sessionStorage.getItem(
        'messagingConversationId'
    );
    isuserGptOptOut = event?.detail?.gptOptOut;
    if (isOngoingConversationASA() && isuserGptOptOut && activeConversationId) {
        hideASAChat();
        window.dispatchEvent(new CustomEvent('showGenAIToast'));
        closeEmbeddedMessagingConversation(event.detail.conversationId);
        sessionStorage.setItem(MESSAGING_ONGOING, false);
        sessionStorage.setItem('messagingConversationId', '');
    }
}

/**
 * End an embedded messaging session related to a given conversation id
 * @param {String} conversationId
 * @param {Object} [config] - optional config object
 * @param {Boolean} [config.logout] - optional flag indicating event was initiated by a logout action
 */
function closeEmbeddedMessagingConversation(conversationId, config) {
    if(!conversationId || conversationId == null || conversationId == 'undefined'){
        conversationId = sessionStorage.getItem('messagingConversationId');
    }
    // Removing "chat" from sessionStorage at the end of the session
    sessionStorage.removeItem('chat');

    if (chatDetails) {
        chatDetails.einsteinSearch = false;
        sessionStorage.removeItem('searchWithAgentforceFlag');
        chatDetails.gaChatViewSent = false;
        chatDetails.gaChatStartSent = false;
        chatDetails.gaChatEndedSent = false;
        chatDetails.proactiveAdoptionAgentClicked = false;
    }
    localStorage.removeItem(HIDE_ASA_AGENT_WELCOME_MSG);
    sessionStorage.removeItem(sessionStorage.getItem('messagingConversationId'), JSON.stringify(chatDetails));
    sessionStorage.setItem(MESSAGING_ONGOING, false);
    embeddedservice_bootstrap.userVerificationAPI.clearSession().then(() => {
        query = '';
        console.debug('Cleared msg session');
    }).catch((error) => {
        console.debug('Failed clearing msg session');
    })
    .finally(() => {
        // TO DO: Handle regardless of result
    });

    if (!embeddedservice_bootstrap || !conversationId) {
        return;
    }

    const storageKey = `${embeddedservice_bootstrap.settings.orgId}_WEB_STORAGE`;
    const storageObj =
        (localStorage.getItem(storageKey) &&
            JSON.parse(localStorage.getItem(storageKey))) ||
        {};
    const jwt = storageObj['JWT'];
    const url = new URL(
        '/iamessage/v1/conversation/' + conversationId,
        embeddedservice_bootstrap.settings.scrt2URL
    );

  fetch(url, {
      method: 'DELETE',
      mode: 'cors',
      headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jwt
      }
  })
      .catch((error) => {
          console.error('Failed to end embedded messaging session: ', error);
      })
      .finally(() => {
          // TO DO: Handle regardless of result
          window.dispatchEvent(new CustomEvent('onEmbeddedMessagingReady'));
          window.dispatchEvent(
              new CustomEvent('onEmbeddedMessagingConversationClosedOnLogout')
          );
      });
}

function handleOnSavedContext() {
    console.log('on saved context');
    //debugger;
   sendAutomatedMessage('Automated message: search answers conversation');
}

function handleAdoptionAgent(event) {
    if (isChatBotAsa()) {
        localStorage.setItem(HIDE_ASA_AGENT_WELCOME_MSG, JSON.stringify(true));
	chatDetails.proactiveAdoptionAgentClicked = true; 
        window.addEventListener(
            'onEmbeddedMessagingConversationOpened',
            (openEvent) => {
                window.dispatchEvent(
                    new CustomEvent('saveAdoptionContextOnMsgSession', {
                        detail: {
                            conversationId: openEvent.detail.conversationId,
                            question: event.detail.question,
                            results: event.detail.results,
                            messagingTag: event.detail.messagingTag,
                            promptInitiatorId: event.detail.promptInitiatorId,
                            qualifiedSignals: event.detail.qualifiedSignals
                        }
                    })
                );
            },
            { once: true }
        );

        embeddedservice_bootstrap.utilAPI.launchChat();
    }
}

function openAdoptionAgentChat() {
  setTimeout(() => {
        sendAutomatedMessage('Automated message: adoption agent conversation');
    }, 200);
}

function sendAutomatedMessage(message) {
    if (receivedMessage) {
        embeddedservice_bootstrap.utilAPI.sendTextMessage(message);
    } else {
        // Wait for the welcome message before sending
        window.addEventListener('onEmbeddedMessageSent', () => {
            embeddedservice_bootstrap.utilAPI.sendTextMessage(message);
        }, { once: true });
    }
}

function handleContinueOnAgentforce(event) {
    if (isChatBotAsa()) {

      embeddedservice_bootstrap.utilAPI
        .launchChat()
        .then((e) => {
          console.log(e);

          if (e.search(/already present/) === -1) {
            console.log("not opened yet");
            chatDetails.einsteinSearch = true;
            sessionStorage.setItem(sessionStorage.getItem('messagingConversationId'), JSON.stringify(chatDetails));
            window.addEventListener(
              "onEmbeddedMessagingConversationOpened",
              (openEvent) => {
                window.dispatchEvent(
                  new CustomEvent("saveContextOnMsgSession", {
                    detail: {
                      conversationId: openEvent.detail.conversationId,
                      query: event.detail.query,
                      results: event.detail.results
                    },
                  })
                );
              },
              { once: true }
            );
          } else {
            console.log("opened already");
            receivedMessage = true;

            window.dispatchEvent(
              new CustomEvent("saveContextOnMsgSession", {
                detail: {
                  conversationId: sessionStorage.getItem(
                    "messagingConversationId"
                  ),
                  query: event.detail.query,
                  results: event.detail.results
                },
              })
            );
          }
        })
        .catch(function (error) {
          console.debug("handleContinueOnAgentforce- Caught error " + error);
        })
        .finally(function () {
          console.debug("handleContinueOnAgentforce- finally ");
        });
    }
  }
/* * Dispatches hcAsyncConversationInitiated event and listens for hcAsyncConversationStarted event.
 * If hcAsyncConversationStarted is not received within 5 seconds, hcAsyncConversationTimedOut event is dispatched.
 * If hcAsyncConversationStarted is received, hcAsyncConversationStartedListener is removed.
 * Used to manage the state of the UI components that performs async actions to initiate a conversation (Adoption Agent CTA, Inline text Input, etc.)
 */
function dispatchHcAsyncConversationInitiated () {
    window.dispatchEvent(new CustomEvent('hcAsyncConversationInitiated'));
    let hcAsyncConversationStarted = false;
    const hcAsyncConversationStartedListener = () => {
        hcAsyncConversationStarted = true;
        window.removeEventListener('onEmbeddedMessagingConversationStarted', hcAsyncConversationStartedListener);
    };

    window.addEventListener('onEmbeddedMessagingConversationStarted', hcAsyncConversationStartedListener);

    // After 5 seconds, check if "onEmbeddedMessagingConversationStarted" event was not received
    setTimeout(() => {
        if (!hcAsyncConversationStarted) {
            window.dispatchEvent(new CustomEvent('hcAsyncConversationError'));
        }
    }, ASYNC_CONVERSATION_START_TIMEOUT_MS);
}

function isAgentforceAgent(agentName) {
    return agentName === 'Agentforce' || agentName === 'Help Agent';
}

  function handleCancelOrgSelection(event){

    let messagingSessionOngoing = sessionStorage.getItem(MESSAGING_ONGOING) === 'true';
    if(messagingSessionOngoing){
        embeddedservice_bootstrap.utilAPI.sendTextMessage('Automated message: org selection cancelled');
    }
  }

/*  ---- W-18806670 START --> GA4 events track summary/citation impression and click ----  */

let iframeOrigin = null;
let iframeWindow = null;
let transcriptSent = false;
let originShared = false;

function getTranscriptId() {
  return sessionStorage.getItem('messagingSessionId') || null;
}

window.addEventListener('message', function(event) {
  // Handshake - share origin between iframe and parent
  if (event.data === 'handshake_iframe:asaInline' && originShared === false) {
    iframeOrigin = event.origin;
    const iframe = document.getElementById('embeddedMessagingFrame');
    if (iframe && iframe.contentWindow) {
      iframeWindow = iframe.contentWindow;
      iframeWindow.postMessage('handshake_parent:helpPortal', iframeOrigin);
    }
    originShared = true;
    return;
  }

  // After handshake, send transcriptId to iframe
  var transcriptId = getTranscriptId();
  if (
    iframeOrigin && 
    event.origin === iframeOrigin && 
    iframeWindow && 
    !transcriptSent
  ) {
    if (typeof transcriptId !== "undefined" && transcriptId !== null) {
      iframeWindow.postMessage({
        event: 'livechat_transcript_id',
        transcriptId: transcriptId
      }, iframeOrigin);
      transcriptSent = true;
    }
  }

  // Listen for impression/click from iframe and push to dataLayer
  if (iframeOrigin && event.origin === iframeOrigin && event.data?.event) {
    if (event.data && event.data.event === 'custEv_contentImpression') {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(event.data);
    }
    if (event.data && event.data.event === 'custEv_contentClick') {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(event.data);
    }
  }
});


/*  ---- W-18806670 END ----  */

setInterval(verifyInProgressChats, 600);
