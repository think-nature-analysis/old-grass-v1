// マップ関連の機能
let map, tileLayer;

/**
 * マップを初期化する
 * @returns {void}
 */
function initMap() {
    console.log('[Map] 地図初期化');

    // マップ初期設定を取得（projectConfigにはデフォルト値がマージ済み）
    const mapConfig = projectConfig.features.initmap;

    map = L.map('mapcontainer', {
        minZoom: 2,
        maxBounds: mapConfig.bounds,
        maxBoundsViscosity: mapConfig.maxBoundsViscosity,
        zoomControl: false,
    });

    map.setView(mapConfig.center, mapConfig.zoom);

    tileLayer = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            attribution: '© OpenStreetMap contributors',
            opacity: 0.75
        }
    ).addTo(map);

    // 住所検索機能を初期化
    initGeocoderControl();

    // マップのクリックイベント
    map.on('click', async function (e) {
        try {
            // 既存の処理があればキャンセル
            const currentToken = getCurrentLoadingToken();
            if (currentToken) {
                cancelCurrentLoading();
            }

            // すべての進行中のAbortControllerをキャンセル
            if (typeof cleanupAllRequests === 'function') {
                cleanupAllRequests();
            }


            // 既存のマーカーを削除
            if (MarkerState.current)
                map.removeLayer(MarkerState.current);

            const lat = e.latlng.lat;
            const lng = e.latlng.lng;

            // 座標値の検証
            if (
                typeof lat !== 'number' ||
                typeof lng !== 'number' ||
                isNaN(lat) ||
                isNaN(lng)
            ) {
                console.error('無効な座標値:', { lat, lng });
                return;
            }

            // マーカー情報を非同期で取得
            const markerInfo = await getMarkerInfo(lat, lng);

            // markerInfoの検証
            if (!markerInfo) {
                console.error('マーカー情報の取得に失敗しました');
                return;
            }

            console.log('マーカー情報を取得しました:', markerInfo);

            // マーカーを非同期で作成
            MarkerState.current = await createMarker(lat, lng);
            // 作成されたマーカーの検証
            if (!MarkerState.current) {
                console.error('マーカーの作成に失敗しました');
                return;
            }

            // 新しいトークンを作成
            const loadingToken = createLoadingToken();

            // 情報パネルを表示
            await showInfoPanel(markerInfo, loadingToken);

            setPanelOpenState(true, false);
        } catch (error) {
            console.error('マップクリック処理中にエラーが発生しました:', error);
            cancelCurrentLoading();
        }
    });
}

/**
 * 経度の範囲を示す縦線を追加する
 * @returns {{lines: L.Polyline[], labels: L.Marker[]}} 作成された線とラベル
 */
function addLongitudeLines() {
    // -179.9999の経度に縦線を引く（西側の境界）
    const westLine = L.polyline(
        [
            [-90, -179.9999], // 南端
            [90, -179.9999], // 北端
        ],
        {
            color: 'black',
            weight: 1.5,
            opacity: 0.7,
            dashArray: '5, 5',
        }
    ).addTo(map);

    // 179.9999の経度に縦線を引く（東側の境界）
    const eastLine = L.polyline(
        [
            [-90, 179.9999], // 南端
            [90, 179.9999], // 北端
        ],
        {
            color: 'black',
            weight: 1.5,
            opacity: 0.7,
            dashArray: '5, 5',
        }
    ).addTo(map);

    // 線にラベルを追加（オプション）
    const westLabel = L.marker([-58, -179.9999], {
        icon: L.divIcon({
            className: 'longitude-label',
            html: '-180°',
            iconSize: [30, 20],
        }),
    }).addTo(map);

    const eastLabel = L.marker([-58, 179.9999], {
        icon: L.divIcon({
            className: 'longitude-label',
            html: '180°',
            iconSize: [30, 20],
        }),
    }).addTo(map);

    // 線とラベルを保存
    return {
        lines: [westLine, eastLine],
        labels: [westLabel, eastLabel],
    };
}

/**
 * 地図を初期状態に戻す
 * @param {boolean} [resetSettings=false] - レイヤー設定もリセットするかどうか
 * @returns {void}
 */
function resetMapToInitialState(resetSettings = false) {
    console.log('[Map] 地図リセット');

    // マップの中心とズームを初期値に戻す
    const mapConfig = projectConfig.features.initmap;
    map.setView(mapConfig.center, mapConfig.zoom);

    // すべてのマーカーを削除
    if (MarkerState.current) {
        map.removeLayer(MarkerState.current);
        MarkerState.current = null;
    }

    // 赤マーカーもすべて削除
    if (map.hasLayer) {
        map.eachLayer(function (layer) {
            if (layer instanceof L.Marker) {
                // デフォルトマーカー以外を削除
                if (layer !== MarkerState.current) {
                    map.removeLayer(layer);
                }
            }
        });
    }

    // すべてのアクティブレイヤーを非表示にする
    LayerState.active.forEach((layerId) => {
        if (LayerState.loaded[layerId] && map.hasLayer(LayerState.loaded[layerId])) {
            map.removeLayer(LayerState.loaded[layerId]);
        }
    });

    // ベクターレイヤーをリセット
    if (typeof resetVectorLayers === 'function') {
        resetVectorLayers();
    }

    // レイヤー設定値をリセット
    if (resetSettings) {
        LayerState.active.forEach((layerId) => {
            const layer = LayerState.loaded[layerId];
            if (layer && layer.georasters) {
                const georaster = layer.georasters[0];
                LayerState.valueRange[layerId] = {
                    min: georaster.mins[0],
                    max: georaster.maxs[0],
                };
            }
        });
    }

    // レイヤー選択をリセット
    document
        .querySelectorAll('#layerList input[type="checkbox"]')
        .forEach((checkbox) => {
            checkbox.checked = false;
        });

    // アクティブレイヤーをクリア
    LayerState.active = [];

    // レイヤー設定UIを更新
    updateLayerSettingsUI();

    // すべてのカラーバー要素を検索して削除
    const allColorbars = document.querySelectorAll('[class^="colorbar-"]');
    allColorbars.forEach((element) => {
        element.remove();
    });
    LayerState.colorbarElements = {};

    // 情報パネルを閉じる
    closeInfoPanel();

    // 状態をリセット
    setPanelOpenState(false, false);
    MarkerState.currentOpenRed = null;
}

/**
 * 住所検索コントロールを初期化する
 * @returns {L.Control.Geocoder} ジオコーダーコントロール
 */
function initGeocoderControl() {
    const geocoder = L.Control.Geocoder.nominatim({
        geocodingQueryParams: {
            'accept-language': 'ja,en',
        },
    });

    const geocodingControl = L.Control.geocoder({
        geocoder: geocoder,
        position: 'topleft',
        placeholder: 'Input address, coordinates etc.(e.g., 35.0,139.0)',
        errorMessage: 'Address not found',
        showResultIcons: true,
        collapsed: false,
        defaultMarkGeocode: false,
    });

    // geocoding処理を完全にオーバーライド
    const originalGeocode = geocodingControl._geocode;
    geocodingControl._geocode = function () {
        const query = this._input.value.trim();

        // 緯度経度形式かチェック
        const coordResult = parseCoordinates(query);
        if (coordResult) {
            console.log('[Map] 座標検索:', coordResult);
            // 緯度経度として直接処理
            const displayName = `緯度: ${coordResult.lat.toFixed(6)}, 経度: ${coordResult.lng.toFixed(6)}`;
            const geocode = {
                center: L.latLng(coordResult.lat, coordResult.lng),
                name: displayName,
            };
            // 直接結果処理を実行
            this.fire('markgeocode', { geocode: geocode });
            return;
        }

        // 住所検索として処理
        console.log('[Map] 住所検索:', query);
        originalGeocode.call(this);
    };

    // 通常の住所検索結果の処理
    geocodingControl.on('markgeocode', function (e) {
        handleGeocodingResult(e.geocode);
    });

    geocodingControl.addTo(map);

    // 検索コントロールの初期化完了後にマウスホイール制御を設定
    setTimeout(() => {
        setupSearchScrollControl(geocodingControl);
    }, 100);
    return geocodingControl;
}

/**
 * ジオコーディング結果を処理する
 * @param {Object} geocode - ジオコーディング結果
 * @param {L.LatLng} geocode.center - 中心座標
 * @param {string} geocode.name - 地名
 * @returns {Promise<void>}
 */
async function handleGeocodingResult(geocode) {
    const latlng = geocode.center;
    const address = geocode.name;
    console.log(`[Map] 検索実行: ${address}`);

    try {
        // 既存のマーカーを削除
        if (MarkerState.current) {
            map.removeLayer(MarkerState.current);
            MarkerState.current = null;
        }

        // 新しいマーカーを作成
        MarkerState.current = await createMarker(
            latlng.lat,
            latlng.lng,
            address
        );

        // 作成されたマーカーの検証
        if (!MarkerState.current) {
            console.error('マーカーの作成に失敗しました');
            return;
        }

        // 地図を移動
        map.setView(latlng, AppConstants.search.defaultZoom);

        // マーカー情報を取得して情報パネルを表示
        const markerInfo = await getMarkerInfo(latlng.lat, latlng.lng, address);
        if (markerInfo) {
            await showInfoPanel(markerInfo);
            setPanelOpenState(true, false);
        }
    } catch (error) {
        console.error('住所検索結果処理中にエラーが発生しました:', error);
    }
}

/**
 * 緯度経度形式を解析する
 * @param {string} input - 入力文字列
 * @returns {{lat: number, lng: number}|null} 座標オブジェクト、解析失敗時はnull
 */
function parseCoordinates(input) {
    if (!input || typeof input !== 'string') return null;

    const cleanInput = input.trim();

    // 複数の緯度経度形式をサポート
    const patterns = [
        // カンマ区切り: "35.6895,139.69171" or "35.6895, 139.69171"
        /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/,
        // スペース区切り: "35.6895 139.69171"
        /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/,
        // 整数での入力: "30 120" (緯度 経度)
        /^(-?\d{1,2})\s+(-?\d{2,3})$/,
    ];

    for (const pattern of patterns) {
        const match = cleanInput.match(pattern);
        if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);

            // 緯度経度の範囲チェック
            if (isValidLatitude(lat) && isValidLongitude(lng)) {
                console.log('有効な座標:', { lat, lng });
                return { lat: lat, lng: lng };
            } else {
                console.log('範囲外の座標:', { lat, lng });
            }
        }
    }

    return null;
}

/**
 * 緯度の有効性をチェック
 * @param {number} lat - 緯度
 * @returns {boolean} 有効な緯度かどうか
 */
function isValidLatitude(lat) {
    return !isNaN(lat) && lat >= -90 && lat <= 90;
}

/**
 * 経度の有効性をチェック
 * @param {number} lng - 経度
 * @returns {boolean} 有効な経度かどうか
 */
function isValidLongitude(lng) {
    return !isNaN(lng) && lng >= -180 && lng <= 180;
}

// 検索窓のスクロール制御を設定する関数
function setupSearchScrollControl(geocodingControl) {
    const container = geocodingControl.getContainer();
    if (!container) return;

    // 入力フィールドでのマウスホイール制御
    const input = container.querySelector('input');
    if (input) {
        input.addEventListener(
            'wheel',
            function (e) {
                e.stopPropagation();
            },
            { passive: false }
        );
    }

    // 既に存在する検索候補リストの制御
    const existingAlternatives = container.querySelector(
        '.leaflet-control-geocoder-alternatives'
    );
    if (existingAlternatives) {
        setupAlternativesScrollControl(existingAlternatives);
    }

    // 動的に追加される検索候補リストの監視
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const alternatives =
                            node.classList &&
                            node.classList.contains(
                                'leaflet-control-geocoder-alternatives'
                            )
                                ? node
                                : node.querySelector &&
                                  node.querySelector(
                                      '.leaflet-control-geocoder-alternatives'
                                  );

                        if (
                            alternatives &&
                            !alternatives.hasAttribute('data-scroll-setup')
                        ) {
                            setupAlternativesScrollControl(alternatives);
                        }
                    }
                });
            }
        });
    });

    observer.observe(container, {
        childList: true,
        subtree: true,
    });
}

// 検索候補リストのスクロール制御を設定する関数
function setupAlternativesScrollControl(alternatives) {
    if (!alternatives || alternatives.hasAttribute('data-scroll-setup')) {
        return;
    }

    // データ属性でセットアップ済みをマーク
    alternatives.setAttribute('data-scroll-setup', 'true');
    // マウスホイールイベントの制御
    alternatives.addEventListener(
        'wheel',
        function (e) {
            // MEMO: 境界でのスクロールも許可するが、マップへの伝播は防ぐ

            // イベントの伝播を完全に停止
            e.stopPropagation();
            e.stopImmediatePropagation();

            // スクロール可能かチェック
            const scrollTop = this.scrollTop;
            const scrollHeight = this.scrollHeight;
            const clientHeight = this.clientHeight;

            // スクロールが必要ない場合
            if (scrollHeight <= clientHeight) {
                e.preventDefault();
                return false;
            }

            return false;
        },
        {
            passive: false,
            capture: true,
        }
    );

    // マウス入力時にマップのスクロールを一時無効化
    alternatives.addEventListener('mouseenter', function () {
        if (map.scrollWheelZoom) {
            map.scrollWheelZoom.disable();
        }
    });

    alternatives.addEventListener('mouseleave', function () {
        if (map.scrollWheelZoom) {
            map.scrollWheelZoom.enable();
        }
    });
}
