Lampa.Platform.tv();

(function () {
    'use strict';

    // Стили адаптивной кнопочной сетки
    var style = document.createElement('style');
    style.innerHTML = `
        .full-start-new__buttons {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 5px !important;
            justify-content: flex-start;
        }

        .full-start__button {
            max-width: 180px;
            flex: 1 1 auto;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* При желании можно ещё визуально приглушить КиноПоиск */
        .full-start__button.view--rate {
            opacity: 0.6;
        }
    `;
    document.head.appendChild(style);

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
                            console.log('[SorterPlugin] Контейнер найден:', targetContainer);

                            var allButtons = fullContainer.find('.buttons--container .full-start__button')
                                .add(targetContainer.find('.full-start__button'));

                            function hasClass(el, name) {
                                return $(el).attr('class').toLowerCase().includes(name);
                            }

                            var cinema = allButtons.filter(function () { return hasClass(this, 'cinema'); });
                            var online = allButtons.filter(function () { return hasClass(this, 'online'); });
                            var torrent = allButtons.filter(function () { return hasClass(this, 'torrent'); });
                            var trailer = allButtons.filter(function () { return hasClass(this, 'trailer'); });
                            var rest = allButtons.not(cinema).not(online).not(torrent).not(trailer);

                            cinema.detach();
                            online.detach();
                            torrent.detach();
                            trailer.detach();
                            rest.detach();

                            var newOrder = []
                                .concat(cinema.get())
                                .concat(online.get())
                                .concat(torrent.get())
                                .concat(trailer.get())
                                .concat(rest.get());

                            targetContainer.empty();
                            newOrder.forEach(function (btn) {
                                targetContainer.append(btn);
                            });

                            // Блокируем раскрытие кнопки КиноПоиска
                            fullContainer.find('.full-start__button.view--rate').each(function () {
                                const btn = $(this);
                                btn.off('hover:enter click'); // Убираем родные реакции
                                btn.on('hover:enter click', function (e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('[SorterPlugin] Кнопка КиноПоиска заблокирована');
                                });
                            });

                            Lampa.Controller.toggle("full_start");
                            console.log('[SorterPlugin] Новый порядок кнопок применён');
                        } catch (err) {
                            console.error('[SorterPlugin] Ошибка сортировки:', err);
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
