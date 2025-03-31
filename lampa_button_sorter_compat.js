Lampa.Platform.tv();

(function () {
    'use strict';

    // Вставляем стили для обеспечения переноса кнопок
    var style = document.createElement('style');
    style.innerHTML = `
        .full-start-new__buttons {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 10px;
            justify-content: flex-start;
        }
    `;
    document.head.appendChild(style);

    console.log('[SorterPlugin] плагин загружен');

    function startPlugin() {
        try {
            // Сбрасываем параметр, если он установлен
            if (Lampa.Storage.get('full_btn_priority') !== undefined) {
                Lampa.Storage.set('full_btn_priority', '{}');
            }

            Lampa.Listener.follow('full', function(e) {
                if (e.type === 'complite') {
                    setTimeout(function() {
                        try {
                            var fullContainer = e.object.activity.render();
                            var targetContainer = fullContainer.find('.full-start-new__buttons');
                            console.log('[SorterPlugin] Контейнер найден:', targetContainer);

                            // Собираем все кнопки из двух контейнеров
                            var allButtons = fullContainer.find('.buttons--container .full-start__button')
                                .add(targetContainer.find('.full-start__button'));
                            console.log('[SorterPlugin] Всего кнопок:', allButtons.length);

                            // Фильтруем группы по классам (с приведением к нижнему регистру)
                            function hasClass(el, name) {
                                return $(el).attr('class').toLowerCase().includes(name);
                            }

                            var cinema = allButtons.filter(function() { return hasClass(this, 'cinema'); });
                            var online = allButtons.filter(function() { return hasClass(this, 'online'); });
                            var torrent = allButtons.filter(function() { return hasClass(this, 'torrent'); });
                            var trailer = allButtons.filter(function() { return hasClass(this, 'trailer'); });

                            // Остальные кнопки – те, которые не попали в предыдущие группы
                            var rest = allButtons.not(cinema).not(online).not(torrent).not(trailer);

                            console.log('[SorterPlugin] Cinema:', cinema.length);
                            console.log('[SorterPlugin] Online:', online.length);
                            console.log('[SorterPlugin] Torrent:', torrent.length);
                            console.log('[SorterPlugin] Trailer:', trailer.length);
                            console.log('[SorterPlugin] Остальные:', rest.length);

                            // Отсоединяем группы для сохранения обработчиков
                            cinema.detach();
                            online.detach();
                            torrent.detach();
                            trailer.detach();
                            rest.detach();

                            // Формируем новый порядок:
                            // 1) Cinema → 2) Online → 3) Torrent → 4) Trailer → 5) Остальные
                            var newOrder = []
                                .concat(cinema.get())
                                .concat(online.get())
                                .concat(torrent.get())
                                .concat(trailer.get())
                                .concat(rest.get());

                            // Очищаем контейнер полностью
                            targetContainer.empty();

                            // Вставляем кнопки в новом порядке
                            newOrder.forEach(function(btn) {
                                targetContainer.append(btn);
                            });

                            Lampa.Controller.toggle("full_start");
                            console.log('[SorterPlugin] Новый порядок кнопок применён');
                        } catch (err) {
                            console.error('[SorterPlugin] Ошибка сортировки:', err);
                        }
                    }, 100); // задержка 100 мс
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
