/**
 * listener for htcreatemeta event to add meta tag to head
 * event.detail.attributeType, event.detail.attributeName and event.detail.attributeValue are required
 * attributes in event detail as it specifies the attribute type, attribute name  and content value for meta tag
 */
window.addEventListener('htcreatemeta', function (event) {
    let querySelectorValue =
        'meta[' +
        event.detail.attributeType +
        '="' +
        event.detail.attributeName +
        '"]';
    let metaTagToRemove = document.querySelectorAll(querySelectorValue);
    metaTagToRemove.forEach((el) => el.remove());

    let metaTag = document.createElement('meta');
    metaTag.setAttribute(
        event.detail.attributeType,
        event.detail.attributeName
    );
    metaTag.content = event.detail.attributeValue;
    document.getElementsByTagName('head')[0].appendChild(metaTag);
});
