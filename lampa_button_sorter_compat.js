
Lampa.Platform.tv();

(function () {
    'use strict';

    function startPlugin() {
        if (Lampa.Storage.get('full_btn_priority') !== undefined) {
            Lampa.Storage.set('full_btn_priority', '{}');
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                setTimeout(function () {
                    var fullContainer = e.object.activity.render();
                    var targetContainer = fullContainer.find('.full-start-new__buttons');

                    fullContainer.find('.button--play').remove();

                    var allButtons = fullContainer.find('.buttons--container .full-start__button')
                        .add(targetContainer.find('.full-start__button'))
                        .not('.cinema'); // Не трогаем Cinema-кнопку

                    var onlineButtons = allButtons.filter(function () {
                        return $(this).attr('class').includes('online');
                    });
                    var torrentButtons = allButtons.filter(function () {
                        return $(this).attr('class').includes('torrent');
                    });
                    var trailerButtons = allButtons.filter(function () {
                        return $(this).attr('class').includes('trailer');
                    });

                    var buttonOrder = [];

                    onlineButtons.each(function () {
                        buttonOrder.push($(this));
                    });

                    torrentButtons.each(function () {
                        buttonOrder.push($(this));
                    });

                    trailerButtons.each(function () {
                        buttonOrder.push($(this));
                    });

                    // Добавляем остальные, не относящиеся к online/torrent/trailer
                    allButtons.filter(function () {
                        return !$(this).attr('class').includes('online') &&
                               !$(this).attr('class').includes('torrent') &&
                               !$(this).attr('class').includes('trailer');
                    }).each(function () {
                        buttonOrder.push($(this));
                    });

                    // Удаляем только свои кнопки (Cinema остаётся)
                    targetContainer.find('.full-start__button').not('.cinema').remove();

                    // Добавляем кнопки обратно в нужном порядке
                    buttonOrder.forEach(function ($button) {
                        targetContainer.append($button);
                    });

                    // Возвращаем управление
                    Lampa.Controller.toggle("full_start");
                }, 100);
            }
        });

        if (typeof module !== 'undefined' && module.exports) {
            module.exports = {};
        }
    }

    startPlugin();
})();
