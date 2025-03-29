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

                            // Получаем все кнопки, исключая Cinema и button--play
                            var allButtons = fullContainer.find('.buttons--container .full-start__button')
                                .add(targetContainer.find('.full-start__button'))
                                .not('.cinema, .button--play');

                            // Классифицируем кнопки по классам
                            var onlineButtons = allButtons.filter(function () {
                                return $(this).hasClass('online');
                            });
                            var torrentButtons = allButtons.filter(function () {
                                return $(this).hasClass('torrent');
                            });
                            var trailerButtons = allButtons.filter(function () {
                                return $(this).hasClass('trailer');
                            });

                            var buttonOrder = [];

                            // Добавляем кнопки по порядку
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
                                return !$(this).hasClass('online') &&
                                       !$(this).hasClass('torrent') &&
                                       !$(this).hasClass('trailer');
                            }).each(function () {
                                buttonOrder.push($(this));
                            });

                            // Сохраняем привязанные события для кнопок и Cinema
                            var cinemaButton = fullContainer.find('.button--play.cinema');
                            var cinemaHandler = cinemaButton.data('event-handler'); // Если Cinema имеет свой обработчик

                            // Используем detach(), чтобы сохранить привязанные события
                            targetContainer.find('.full-start__button').not('.cinema, .button--play').detach();

                            // Вставляем кнопки в новом порядке
                            buttonOrder.forEach(function ($button) {
                                targetContainer.append($button);
                            });

                            // Восстанавливаем обработчик для Cinema, если он был
                            if (cinemaButton.length && cinemaHandler) {
                                cinemaButton.on('click', cinemaHandler);
                            }

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
