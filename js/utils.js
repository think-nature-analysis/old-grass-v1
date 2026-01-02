// ユーティリティ関数
const Utils = {
    /**
     * 指定した要素にローディングインジケータを表示する
     * @param {HTMLElement} element - インジケータを追加する親要素
     */
    showLoadingIndicator: (element) => {
        if (!element) return;

        // 既存のローディングインジケータを削除
        const existingIndicator = element.querySelector('.loading-indicator');
        if (existingIndicator) existingIndicator.remove();

        // ローディングインジケータを作成
        const loadingIndicator = document.createElement('span');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.textContent = ' 読み込み中...';
        loadingIndicator.style.marginLeft = '5px';
        loadingIndicator.style.color = '#666';
        loadingIndicator.style.fontSize = '12px';

        element.appendChild(loadingIndicator);
    },

    /**
     * 指定した要素からローディングインジケータを削除する
     * @param {HTMLElement} element - インジケータを削除する親要素
     */
    hideLoadingIndicator: (element) => {
        if (!element) return;

        const loadingIndicator = element.querySelector('.loading-indicator');
        if (loadingIndicator) loadingIndicator.remove();
    },

    /**
     * 小数点第n位で四捨五入する
     * @param {number|null|undefined} num - 数値
     * @param {number} decimal - 小数点以下の桁数
     * @returns {number|string} 四捨五入された数値、無効な場合は'N/A'
     */
    roundTo: (num, decimal) => {
        if (num === null || num === undefined || isNaN(num)) return 'N/A';
        return Math.round(num * 10 ** decimal) / 10 ** decimal;
    },

    /**
     * ArrayBufferをクローンする
     * @param {ArrayBuffer} original - 元のArrayBuffer
     * @returns {ArrayBuffer} クローンされたArrayBuffer
     */
    cloneArrayBuffer: (original) => {
        const clone = new ArrayBuffer(original.byteLength);
        new Uint8Array(clone).set(new Uint8Array(original));
        return clone;
    },

    /**
     * CSVファイルを解析してマーカーデータを取得する
     * @param {string} csvData - CSV文字列
     * @returns {Array<{name: string, lat: number, lon: number, id: string|null}>} マーカーデータの配列
     */
    parseCSV: (csvData) => {
        const lines = csvData.split('\n');
        const markers = [];

        if (lines.length < 2) return markers; // ヘッダー行とデータ行が最低限必要

        // ヘッダー行を解析して列のインデックスを特定
        const headerLine = lines[0].trim();
        const headers = headerLine
            .split(',')
            .map((header) => header.trim().toLowerCase());

        // 必要な列のインデックスを特定
        const nameIndex = headers.findIndex(
            (header) =>
                header === 'name' ||
                header === '地点名' ||
                header === '名称' ||
                header === '地名' ||
                header === '拠点名'
        );
        const latIndex = headers.findIndex(
            (header) =>
                header === 'lat' || header === '緯度' || header === 'latitude'
        );
        const lonIndex = headers.findIndex(
            (header) =>
                header === 'lon' ||
                header === 'lng' ||
                header === '経度' ||
                header === 'longitude'
        );
        // ID列のインデックス
        const idIndex = headers.findIndex(
            (header) =>
                header === 'id' || header === 'ID' || header === 'identifier'
        );

        // 必要な列が見つからない場合はエラー
        if (latIndex === -1 || lonIndex === -1) {
            alert(
                'CSVファイルに緯度・経度の列が見つかりません。\n列名には「lat/緯度」と「lon/lng/経度」を含めてください。'
            );
            return markers;
        }

        // ヘッダー行をスキップして2行目から処理
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;

            // 単純なカンマ区切りで分割
            const parts = lines[i].split(',');

            // 緯度経度を取得
            const lat = parseFloat(parts[latIndex].trim());
            const lon = parseFloat(parts[lonIndex].trim());

            // 名称を取得（名称列が見つからない場合は緯度経度を使用）
            const name =
                nameIndex !== -1
                    ? parts[nameIndex].trim()
                    : `Loc(${lat.toFixed(4)}, ${lon.toFixed(4)})`;

            // IDを取得（ID列が見つからない場合はnullまたはデフォルト値を使用）
            const id = idIndex !== -1 ? parts[idIndex].trim() : null;

            if (!isNaN(lat) && !isNaN(lon)) {
                markers.push({
                    name: name,
                    lat: lat,
                    lon: lon,
                    id: id,
                });
            }
        }

        return markers;
    },

    // JSONファイル全体を一度だけ読み込む
    layerConfigCache: null,

    /**
     * レイヤー設定を取得する
     * @param {string} layerId - レイヤーID
     * @returns {Promise<Object|null>} レイヤー設定オブジェクト
     */
    getLayerConfig: async (layerId) => {
        // 全体キャッシュがなければ一度だけ読み込む
        if (!Utils.layerConfigCache) {
            try {
                const response = await fetch(AppConstants.urls.layersConfig);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const config = await response.json();

                // オブジェクトに変換してキャッシュ
                Utils.layerConfigCache = {};
                config.layers.forEach((layer) => {
                    Utils.layerConfigCache[layer.id] = layer;
                });
            } catch (error) {
                console.error('レイヤー設定の読み込みに失敗しました:', error);
                return null;
            }
        }

        // レイヤーIDが指定されていない場合はデフォルトレイヤーを使用
        const selectedLayerId = layerId || AppConstants.layers.defaultLayerId;

        // キャッシュから取得
        const layer = Utils.layerConfigCache[selectedLayerId];
        if (!layer) {
            console.warn(`レイヤー ${selectedLayerId} が見つかりません`);
            return null;
        }

        return layer;
    },

    // 全レイヤー設定を取得する関数
    getAllLayerConfigs: async () => {
        try {
            const response = await fetch(AppConstants.urls.layersConfig);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const config = await response.json();
            return config.layers;
        } catch (error) {
            console.error('レイヤー設定の取得に失敗しました:', error);
            return [];
        }
    },

    // 10分グリッド計算関数
    calculateGridIndices: (lat, lon) => {
        // 10分 = 1/6度 = 0.16667度
        const gridSize = 1 / 6;

        // 緯度インデックス（-90度から+90度まで、1080グリッド）
        const latIndex = Math.floor((lat + 90) / gridSize);

        // 経度インデックス（-180度から+180度まで、2160グリッド）
        const lonIndex = Math.floor((lon + 180) / gridSize);

        // インデックスの範囲チェック
        const validLatIndex = Math.max(0, Math.min(1079, latIndex));
        const validLonIndex = Math.max(0, Math.min(2159, lonIndex));

        return {
            lat: validLatIndex,
            lon: validLonIndex,
            gridId: `${validLatIndex}_${validLonIndex}`,
        };
    },

    // グリッドの中心座標を計算する関数（オプション）
    getGridCenter: (latIndex, lonIndex) => {
        const gridSize = 1 / 6;
        const centerLat = latIndex * gridSize - 90 + gridSize / 2;
        const centerLon = lonIndex * gridSize - 180 + gridSize / 2;
        return { lat: centerLat, lon: centerLon };
    },

    /**
     * 緯度経度から3次メッシュコードを計算する
     * @param {number} lat - 緯度
     * @param {number} lon - 経度
     * @param {number} [order=3] - メッシュの次数
     * @returns {string|null} メッシュコード、範囲外の場合はnull
     */
    latlonToMeshcode: (lat, lon, order = 3) => {
        // NaN や null/undefined チェック
        if (isNaN(lat) || isNaN(lon) || lat == null || lon == null) {
            return null;
        }

        // 日本の大まかな範囲チェック
        // 緯度：20～46度、経度：122～154度の範囲外は無効とする
        if (lat < 20 || lat > 46 || lon < 122 || lon > 154) {
            return null;
        }

        try {
            // 緯度の処理
            const lat_in_min = lat * 60;
            const code1_lat = Math.floor(lat_in_min / 40);
            let lat_rest_in_min = lat_in_min - code1_lat * 40;
            const code2_lat = Math.floor(lat_rest_in_min / 5);
            const code15_lat = Math.floor(lat_rest_in_min / 10);
            lat_rest_in_min = lat_rest_in_min - code2_lat * 5;
            const code3_lat = Math.floor(lat_rest_in_min / (5 / 10));
            lat_rest_in_min = lat_rest_in_min - (code3_lat * 5) / 10;
            const code4_lat = Math.floor(lat_rest_in_min / (5 / 100));

            // 経度の処理
            const code1_lon = Math.floor(lon) - 100;
            let lon_rest_in_deg = lon - Math.floor(lon);
            const code2_lon = Math.floor(lon_rest_in_deg * 8);
            const code15_lon = Math.floor(lon_rest_in_deg * 4);
            lon_rest_in_deg = lon_rest_in_deg - code2_lon / 8;
            const code3_lon = Math.floor(lon_rest_in_deg / (1 / 80));
            lon_rest_in_deg = lon_rest_in_deg - code3_lon / 80;
            const code4_lon = Math.floor(lon_rest_in_deg / (1 / 800));

            // 各コード要素の妥当性チェック
            if (
                code1_lat < 0 ||
                code1_lat > 99 ||
                code1_lon < 0 ||
                code1_lon > 99 ||
                code2_lat < 0 ||
                code2_lat > 7 ||
                code2_lon < 0 ||
                code2_lon > 7 ||
                code3_lat < 0 ||
                code3_lat > 9 ||
                code3_lon < 0 ||
                code3_lon > 9
            ) {
                return null;
            }

            // メッシュコードの組み立て
            let code =
                code1_lat.toString().padStart(2, '0') +
                code1_lon.toString().padStart(2, '0');

            if (order === 1.5) {
                code = code + '_' + code15_lat + code15_lon;
                return code;
            }

            if (order >= 2) {
                code = code + code2_lat.toString() + code2_lon.toString();
            }

            if (order >= 3) {
                code = code + code3_lat.toString() + code3_lon.toString();
            }

            if (order >= 4) {
                code = code + code4_lat.toString() + code4_lon.toString();
            }

            if (order === 2.5) {
                let code2_5;
                if (code3_lat <= 4 && code3_lon <= 4) {
                    code2_5 = 1;
                } else if (code3_lat <= 4 && code3_lon > 4) {
                    code2_5 = 2;
                } else if (code3_lat > 4 && code3_lon <= 4) {
                    code2_5 = 3;
                } else if (code3_lat > 4 && code3_lon > 4) {
                    code2_5 = 4;
                }
                code = code + code2_5.toString();
            }

            const result = parseInt(code);

            // 3次メッシュコードの場合、8桁の数字かチェック
            if (order === 3) {
                if (result < 10000000 || result > 99999999) {
                    return null;
                }
            }

            return result;
        } catch (error) {
            console.error('メッシュコード計算エラー:', error);
            return null;
        }
    },

    /**
     * 緯度経度から世界グリッドのキーを計算する
     * @param {number} x - 経度
     * @param {number} y - 緯度
     * @param {number} [minute=10] - グリッドの分単位
     * @returns {string|null} グリッドキー、範囲外の場合はnull
     */
    lonlatToGridkey: (x, y, minute = 10) => {
        // x: 経度 (longitude)
        // y: 緯度 (latitude)
        // minute: グリッドサイズ（分単位、デフォルト10分）

        try {
            // 入力値の妥当性チェック
            if (isNaN(x) || isNaN(y) || x == null || y == null) {
                return null;
            }

            // 経度・緯度の範囲チェック
            if (x < -180 || x > 180 || y < -90 || y > 90) {
                return null;
            }

            // 度
            let xd, yd;
            if (x >= 0) {
                xd = Math.floor(x);
            } else {
                xd = Math.ceil(x);
            }

            if (y >= 0) {
                yd = Math.floor(y);
            } else {
                yd = Math.ceil(y);
            }

            // 分
            const xm = Math.abs(x - xd);
            const ym = Math.abs(y - yd);

            // 分の基準を返す
            const xmR =
                (Math.floor((xm * 60) / minute) * minute) / 100 + minute / 200;
            const ymR =
                (Math.floor((ym * 60) / minute) * minute) / 100 + minute / 200;

            // 度と分を結合する
            let xR, yR;
            if (x >= 0) {
                xR = xd + xmR;
            } else {
                xR = xd - xmR;
            }

            if (y >= 0) {
                yR = yd + ymR;
            } else {
                yR = yd - ymR;
            }

            // keyとする（小数点以下の桁数を制限）
            const xRounded = Math.round(xR * 100) / 100;
            const yRounded = Math.round(yR * 100) / 100;
            const gridkey = `${xRounded}_${yRounded}`;

            return gridkey;
        } catch (error) {
            console.error('グリッドキー計算エラー:', error);
            return null;
        }
    },

    // 現在アクティブなレイヤーIDを取得（アクティブレイヤーがない場合はデフォルトレイヤー）
    getCurrentLayerId: () => {
        if (
            LayerState.active &&
            LayerState.active.length > 0
        ) {
            // 最後にアクティブにされたレイヤーを返す
            return LayerState.active.slice(-1)[0];
        } else {
            // レイヤー未選択時はデフォルトレイヤーを返す
            return AppConstants.layers.defaultLayerId;
        }
    },

    /**
     * アクティブレイヤーから位置コードタイプを取得する
     * @returns {Promise<string>} 位置コードタイプ ('meshCode' または 'worldGrid')
     */
    getLocationCodeTypeForMarker: async () => {
        try {
            const layerId = Utils.getCurrentLayerId();
            const layerConfig = await Utils.getLayerConfig(layerId);

            if (
                layerConfig &&
                layerConfig.locationCode &&
                layerConfig.locationCode.type
            ) {
                return layerConfig.locationCode.type;
            }

            // フォールバック: プロジェクト設定またはデフォルト値
            return projectConfig?.features?.locationCodes?.type || 'worldGrid';
        } catch (error) {
            console.error('位置コードタイプ取得エラー:', error);
            return 'worldGrid'; // デフォルト値
        }
    },

    /**
     * アクティブレイヤーから表示モードを取得する
     * @returns {Promise<string>} 表示モード ('image' または 'iframe')
     */
    getDisplayModeForMarker: async () => {
        try {
            const layerId = Utils.getCurrentLayerId();
            const layerConfig = await Utils.getLayerConfig(layerId);

            if (layerConfig && layerConfig.displayMode) {
                return layerConfig.displayMode;
            }

            // フォールバック: プロジェクト設定またはデフォルト値
            return projectConfig?.features?.detailPanel?.displayMode || 'image';
        } catch (error) {
            console.error('表示モード取得エラー:', error);
            return 'image'; // デフォルト値
        }
    },

    /**
     * レイヤー設定からパス情報を取得する
     * @param {string} layerId - レイヤーID
     * @returns {Promise<Object>} パス設定オブジェクト
     */
    getPathsForLayer: async (layerId) => {
        // レイヤーIDが指定されていない場合はデフォルトレイヤーを使用
        const selectedLayerId = layerId || AppConstants.layers.defaultLayerId;
        const layerConfig = await Utils.getLayerConfig(selectedLayerId);

        if (layerConfig && layerConfig.paths) {
            return {
                ...layerConfig.paths,
                // 新しいプロパティも含める
                urltype: layerConfig.urltype || 'raw',
                urlbase:
                    layerConfig.urlbase ||
                    layerConfig.paths.baseUrl ||
                    '../html/',
            };
        }

        // フォールバック: プロジェクト設定
        return {
            basedir: projectConfig?.features?.detailPanel?.basedir || '../img/',
            baseUrl:
                projectConfig?.features?.detailPanel?.baseUrl || '../html/',
            idBasedir:
                projectConfig?.features?.detailPanel?.idBasedir ||
                '../my_assets/',
            idBaseUrl:
                projectConfig?.features?.detailPanel?.idBaseUrl ||
                '../my_assets/',
            fallbackImage:
                projectConfig?.features?.detailPanel?.fallbackImage ||
                '../default_img/noimage1.png',
            timeoutImage:
                projectConfig?.features?.detailPanel?.timeoutImage ||
                '../default_img/timeout_image.png',
        };
    },
};
