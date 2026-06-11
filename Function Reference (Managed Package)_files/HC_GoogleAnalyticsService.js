window.addEventListener('sendCaseLoadFormEvent', sendCaseLoadFormGAEvent);

document.addEventListener('www_track', handleGAEvent);

document.addEventListener('click', handleClicks);

window.addEventListener('replaceState', function (e) {
    chatBotInitializationEvent.isChatBotView = false;
});

function sendCaseLoadFormGAEvent(event) {
    setTimeout(() => {
            dataLayer.push({
                event: 'custev_formimpression',
                authenticated: true,
                formName: event.detail
            });
    }, 15000);
}

function handleClicks(event) {
    if (location.href.includes('case-submission')) {
        chatBotClosedEvent(event);
        chatBotInitializationEvent(event);
        chatBotViewEvent(event);
    } else {
        chatCloseEvent(event);
        chatViewEvent(event);
    }
    if (event.target.classList.contains('bannerLayoutButton') &&
        event.target.classList.contains('slds-button') &&
        event.target.classList.contains('slds-button_brand') &&
        event.target.textContent === 'Log in to Contact Support') {
            event.preventDefault();
            document.dispatchEvent(
                new CustomEvent('updateGTMdataLayer', {
                    detail:
                    {
                        event: 'custEv_contentClick',
                        click_text: event.target.textContent,
                        click_url: event.target.href,
                        element_title: 'banner',
                        element_type: 'button'
                    }
                })
            );
            window.open(event.target.href, '_self');
    }
}

function searchSelectorInComposedPath(event, selectors) {
    return event.composedPath().some((item) => {
        return item instanceof HTMLElement !== false && item.matches(selectors);
    });
}

// to push chat close event to google analytics

function chatCloseEvent(event) {

    let chatCloseClick;

    if (searchSelectorInComposedPath(event, 'embeddedservice-chat-header .closeButton')) {
        chatCloseClick = 'x';
    } else if (event.target.matches('button.waitingCancelChat span')) {
        chatCloseClick = 'cancel chat request';
    }

    if(chatCloseClick){
        const dlEvent = {
            event: 'custev_chatclose',
            authenticated: true,
            chatLocation:  !!getHcChatLocationFromSnapin ? getHcChatLocationFromSnapin() : 'footer modal',
            chatExperience: 'agent chat',
            chatCloseClick: chatCloseClick
        };
        dataLayer.push(dlEvent);
    }
}
//end of chat close event

// to push chat View event to google analytics

function chatViewEvent(event) {
    if (event.target.hasAttribute('fromcode')) {
        event.target.removeAttribute('fromcode');
    } else if (
        event
            .composedPath()
            .some(
                (item) =>
                    item instanceof HTMLElement !== false &&
                    item.matches('.embeddedServiceHelpButton .flatButton') &&
                    item.ariaLabel === 'Loading'
            )
    ) {
        dataLayer.push({
            event: 'custev_chatview',
            authenticated: true,
            chatLocation: 'footer modal',
            chatExperience: 'agent chat'
        });
    }
}

//End of Chat Initialized event

function chatBotClosedEvent(event) {
    let dlEvent = {
        event: 'custev_chatclose',
        authenticated: true,
        chatLocation: chatBotIntentLabel,
        chatExperience: 'support bot chat'
    };

    if (searchSelectorInComposedPath(event, 'embeddedservice-chat-header .closeButton')) {
        dlEvent.chatCloseClick = 'x';
        dataLayer.push(dlEvent);
    } else if (searchSelectorInComposedPath(event, 'button.waitingCancelChat')) {
        dlEvent.chatCloseClick = 'cancel chat request';
        dataLayer.push(dlEvent);
    }
}

function chatBotInitializationEvent(event) {
    if (!chatBotInitializationEvent.isChatBotView && event.target.matches('button.rich-menu-itemOptionIsClicked')) {
        dataLayer.push({
            event: 'custev_chatinitialization',
            authenticated: true,
            chatLocation: chatBotIntentLabel,
            chatExperience: 'support bot chat',
            chatOption: event.target.innerText
        });
        chatBotInitializationEvent.isChatBotView = true;
    }
}

function chatBotViewEvent(event) {
    if (searchSelectorInComposedPath(event, '.embeddedServiceHelpButton')) {
        dataLayer.push({
            event: 'custev_chatview',
            authenticated: true,
            chatLocation: chatBotIntentLabel,
            chatExperience: 'support bot chat'
        });
    }
}

function handleGAEvent(event) {
    const targetElement = document.querySelector('hgf-c360contextnav')?.shadowRoot
    ?.querySelector('.contextnav')?.querySelector('.contextnav__header')
    ?.querySelector('.contextnav__wrapper').querySelector('.contextnav__ctas')
    ?.querySelector('.contextnav__ctas-button-container.cta-primary');

    const targetElementText = targetElement?.querySelector('hgf-button')?.textContent;
    const targetElementUrl = targetElement?.querySelector('hgf-button')?.href;

    if (targetElement) {
        targetElement.onclick = function() {
            document.dispatchEvent(
                new CustomEvent('updateGTMdataLayer', {
                    detail:
                    {
                        event: 'custEv_contentClick',
                        click_text: targetElementText,
                        click_url: targetElementUrl,
                        element_title: 'banner',
                        element_type: 'button'
                    }
                })
            );
        };
    }
}
