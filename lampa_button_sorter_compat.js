Lampa.Platform.tv();

(function () {
    'use strict';
    
    console.log('[SorterPlugin] плагин загружен');

    function startPlugin() {
        try {
            if (Lampa.Storage.get('full_btn_priority') !== undefined) {
                Lampa.Storage.set('full_btn_priority', '{}');
            }

            Lampa.Listener.follow('full', function (e) {
                if (e.type === 'complite') {
                    setTimeout(function () {
                        try {
                            var fullContainer = e.object.activity.render();
                            var targetContainer = fullContainer.find('.full-start-new__buttons');
                            console.log('[SorterPlugin] Обнаружен контейнер:', targetContainer);

                            fullContainer.find('.button--play').remove();

                            // Получаем все кнопки, исключая Cinema
                            var allButtons = fullContainer.find('.buttons--container .full-start__button')
                                .add(targetContainer.find('.full-start__button'))
                                .not('.cinema');

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
                            // Остальные кнопки
                            allButtons.filter(function () {
                                return !$(this).attr('class').includes('online') &&
                                       !$(this).attr('class').includes('torrent') &&
                                       !$(this).attr('class').includes('trailer');
                            }).each(function () {
                                buttonOrder.push($(this));
                            });

                            // Удаляем свои кнопки, оставляя Cinema нетронутыми
                            targetContainer.find('.full-start__button').not('.cinema').remove();

                            // Добавляем кнопки в новом порядке
                            buttonOrder.forEach(function ($button) {
                                targetContainer.append($button);
                            });

                            Lampa.Controller.toggle("full_start");
                            console.log('[SorterPlugin] Порядок кнопок изменён');
                        } catch (err) {
                            console.error('[SorterPlugin] Ошибка в сортировке кнопок:', err);
                        }
                    }, 100);
                }
            });

            if (typeof module !== 'undefined' && module.exports) {
                module.exports = {};
            }
        } catch (err) {
            console.error('[SorterPlugin] Ошибка инициализации плагина:', err);
        }
    }

    startPlugin();
})();
