function main() {
    Lampa.Listener.follow('full', function (e) {
        if (e.type === 'complite') {
            setTimeout(function () {
                var fullContainer = e.object.activity.render();
                var targetContainer = fullContainer.find('.full-start-new__buttons');
                fullContainer.find('.button--play').remove();
                var allButtons = fullContainer.find('.buttons--container .full-start__button').add(targetContainer.find('.full-start__button'));
                var categories = {
                    online: [],
                    torrent: [],
                    trailer: [],
                    other: []
                };
                allButtons.each(function () {
                    var $button = $(this);
                    var className = $button.attr('class') || '';
                    if (className.includes('online')) categories.online.push($button);
                    else if (className.includes('torrent')) categories.torrent.push($button);
                    else if (className.includes('trailer')) categories.trailer.push($button);
                    else categories.other.push($button.clone(true));
                });
                var buttonSortOrder = Lampa.Storage.get('lme_buttonsort') || ['torrent', 'online', 'trailer', 'other'];
                targetContainer.empty();
                buttonSortOrder.forEach(function (category) {
                    categories[category].forEach(function ($button) {
                        targetContainer.append($button);
                    });
                });
                if (Lampa.Storage.get('lme_showbuttonwn') == true) {
                    targetContainer.find("span").remove();
                }
                targetContainer.css({
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px'
                });
                Lampa.Controller.toggle("full_start");
            }, 100);
        }
    });
}
