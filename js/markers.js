// マーカー関連の機能

// マーカーアイコン
const MarkerIcons = {
    red: null,
};

// マーカーの状態管理
const MarkerState = {
    current: null, // 現在選択されているマーカー
    currentOpenRed: null, // 現在開いている赤マーカー
};

/**
 * 赤色のマーカーアイコンを初期化する
 * @returns {void}
 */
function initMarkerIcons() {
    MarkerIcons.red = L.icon({
        iconUrl: './assets/markers/marker-icon-2x-red.png',
        shadowUrl: './assets/markers/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
    });
}

/**
 * マーカーを作成する
 * @param {number} lat - 緯度
 * @param {number} lon - 経度
 * @param {string} [name] - マーカー名
 * @param {boolean} [isRedMarker=false] - 赤マーカーかどうか
 * @param {string|null} [id=null] - カスタムID
 * @returns {Promise<L.Marker|null>} 作成されたマーカー、失敗時はnull
 */
async function createMarker(lat, lon, name, isRedMarker = false, id = null) {
    try {
        // マーカー情報を非同期で取得
        const markerInfo = await getMarkerInfo(lat, lon, name, id);

        // markerInfoの検証
        if (!markerInfo) {
            console.error('[Marker] マーカー情報の取得に失敗');
            return null;
        }

        // マーカーを作成
        const markerIcon = isRedMarker ? MarkerIcons.red : L.Icon.Default.prototype;
        const marker = L.marker([lat, lon], { icon: markerIcon })
            .addTo(map)
            .bindPopup(markerInfo.popupContent);

        // マーカーにIDを保存
        if (id) {
            marker.customId = id;
        }

        // クリックイベントを設定
        if (isRedMarker) {
            // 赤マーカーの場合
            marker.on('click', function (e) {
                handleRedMarkerClick(e, marker, markerInfo);
            });

            // ポップアップ表示時にも内容を更新
            marker.on('popupopen', async function () {
                try {
                    // 最新のマーカー情報を非同期で取得
                    const updatedMarkerInfo = await getMarkerInfo(
                        lat,
                        lon,
                        name,
                        id
                    );
                    if (updatedMarkerInfo) {
                        marker.setPopupContent(updatedMarkerInfo.popupContent);
                    }
                } catch (error) {
                    console.error('ポップアップ更新エラー:', error);
                }
            });
        } else {
            // 青マーカーの場合
            marker.on('click', function (e) {
                handleMarkerClick(e, marker);
            });
            // 青ピンの場合はポップアップを開く
            marker.openPopup();
        }

        return marker;
    } catch (error) {
        ErrorHandler.logError('マーカー作成中にエラーが発生しました:', error);
        return null;
    }
}

/**
 * ポイントがポリゴン内にあるかをチェックする（射線アルゴリズム）
 * @param {number[]} point - [経度, 緯度]の配列
 * @param {number[][]} polygon - ポリゴンの座標配列
 * @returns {boolean} ポイントがポリゴン内にあればtrue
 */
function isPointInPolygon(point, polygon) {
    // ポイントの座標
    const x = point[0],
        y = point[1];

    // 射線アルゴリズムの実装
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0],
            yi = polygon[i][1];
        const xj = polygon[j][0],
            yj = polygon[j][1];

        // 緯度の範囲内にポイントがあり、経度方向の射線が多角形の辺と交差するかチェック
        const intersect =
            yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }

    return inside;
}

/**
 * マーカー情報を取得する
 * @param {number} lat - 緯度
 * @param {number} lon - 経度
 * @param {string} [name] - マーカー名
 * @param {string|null} [id=null] - カスタムID
 * @returns {Promise<Object|null>} マーカー情報オブジェクト、失敗時はnull
 */
async function getMarkerInfo(lat, lon, name, id = null) {
    try {
        // lat, lonが有効な値かチェック
        if (
            typeof lat !== 'number' ||
            typeof lon !== 'number' ||
            isNaN(lat) ||
            isNaN(lon)
        ) {
            console.error('無効な座標値:', { lat, lon });
            return null;
        }

        // 選択されているレイヤーの値を取得
        const layerValues = {};
    // アクティブなラスターレイヤーの値を取得
    LayerState.active.forEach((layerId) => {
        if (LayerState.loaded[layerId] && LayerState.loaded[layerId].georasters) {
            const value = geoblaze.identify(
                LayerState.loaded[layerId].georasters[0],
                [lon, lat]
            );
            layerValues[layerId] = value;
        }
    });

    // ベクターレイヤーのデータを取得
    const vectorFeatures = {};
    if (
        typeof VectorState.active !== 'undefined' &&
        typeof VectorState.loaded !== 'undefined'
    ) {
        VectorState.active.forEach((vectorLayerId) => {
            const vectorLayer = VectorState.loaded[vectorLayerId];
            if (vectorLayer) {
                let foundFeature = null;
                vectorLayer.eachLayer(function (layer) {
                    if (layer.feature) {
                        if (layer.feature.geometry.type === 'Point') {
                            const coords = layer.feature.geometry.coordinates;
                            const featureLat = coords[1];
                            const featureLon = coords[0];
                            const distance = L.latLng(lat, lon).distanceTo(
                                L.latLng(featureLat, featureLon)
                            );
                            if (distance < AppConstants.marker.pointDetectionRadius) {
                                foundFeature = layer.feature;
                            }
                        } else if (
                            layer.feature.geometry.type === 'Polygon' ||
                            layer.feature.geometry.type === 'MultiPolygon'
                        ) {
                            let isInPolygon = false;
                            try {
                                const polygonGeoJSON = layer.feature.geometry;
                                const point = [lon, lat];
                                if (polygonGeoJSON.type === 'Polygon') {
                                    isInPolygon = isPointInPolygon(
                                        point,
                                        polygonGeoJSON.coordinates[0]
                                    );
                                } else if (
                                    polygonGeoJSON.type === 'MultiPolygon'
                                ) {
                                    isInPolygon =
                                        polygonGeoJSON.coordinates.some(
                                            (polygonCoords) => {
                                                return isPointInPolygon(
                                                    point,
                                                    polygonCoords[0]
                                                );
                                            }
                                        );
                                }
                                if (isInPolygon) {
                                    foundFeature = layer.feature;
                                }
                            } catch (e) {
                                console.error(
                                    'ポリゴン判定中にエラーが発生しました:',
                                    e
                                );
                            }
                        }
                    }
                });
                if (foundFeature) {
                    vectorFeatures[vectorLayerId] = foundFeature;
                    if (
                        foundFeature.properties &&
                        typeof VectorState !== 'undefined'
                    ) {
                        const propertyName =
                            VectorState.propertyField[vectorLayerId];
                        if (
                            propertyName &&
                            foundFeature.properties[propertyName] !== undefined
                        ) {
                            layerValues[vectorLayerId] =
                                foundFeature.properties[propertyName];
                        }
                    }
                }
            }
        });
    }

    // 位置コードタイプを動的に取得
    let locationCodeType;
    try {
        if (
            typeof Utils !== 'undefined' &&
            Utils.getLocationCodeTypeForMarker
        ) {
            locationCodeType = await Utils.getLocationCodeTypeForMarker();
        } else {
            locationCodeType =
                projectConfig?.features?.locationCodes?.type || 'worldGrid';
        }
    } catch (error) {
        console.error('位置コードタイプ取得エラー:', error);
        locationCodeType =
            projectConfig?.features?.locationCodes?.type || 'worldGrid';
    }

    // 3次メッシュコードを計算
    const meshcode3 = Utils.latlonToMeshcode(lat, lon, 3);
    // 世界グリッドキー（10分グリッド）を計算
    const worldGridKey = Utils.lonlatToGridkey(lon, lat, 10);

    // ポップアップ内容を作成
    let popupContent = name
        ? `${name}<br>(LAT, LON) = (${lat.toFixed(4)}, ${lon.toFixed(4)})`
        : `(LAT, LON) = (${lat.toFixed(4)}, ${lon.toFixed(4)})`;

    // IDがある場合はポップアップに表示
    if (id) {
        popupContent += `<br>ID: ${id}`;
    }

    // 各レイヤーの値を直接追加
    Object.keys(layerValues).forEach((layerId) => {
        if (
            layerValues[layerId] !== undefined &&
            layerValues[layerId] !== null
        ) {
            if (LayerState.loaded[layerId] && LayerState.loaded[layerId].georasters) {
                popupContent += `<br>${layerId}: ${Utils.roundTo(layerValues[layerId], 4)}`;
            }
            if (vectorFeatures[layerId]) {
                const propertyName = VectorState.propertyField[layerId];
                popupContent += `<br>${layerId} > ${propertyName}: ${layerValues[layerId]}`;
            }
        }
    });

    // 位置コードの追加
    if (locationCodeType === 'meshCode') {
        if (meshcode3 !== null) {
            popupContent += `<br>3次メッシュコード: ${meshcode3}`;
        } else {
            popupContent += `<br>3次メッシュコード: Out of Range`;
        }
    }

    if (locationCodeType === 'worldGrid') {
        if (worldGridKey !== null) {
            popupContent += `<br>世界グリッドキー(10分): ${worldGridKey}`;
        } else {
            popupContent += `<br>世界グリッドキー(10分): Out of Range`;
        }
    }

        return {
            lat,
            lon,
            name: name || `Loc(${lat.toFixed(4)}, ${lon.toFixed(4)})`,
            id: id,
            layerValues,
            vectorFeatures,
            popupContent,
            meshcode3: meshcode3 !== null ? meshcode3 : 'Out of Range',
            worldGridKey: worldGridKey !== null ? worldGridKey : 'Out of Range',
            locationCodeType: locationCodeType,
        };
    } catch (error) {
        ErrorHandler.logError('マーカー情報取得中にエラーが発生しました:', error);
        return null;
    }
}

/**
 * 通常マーカーのクリックイベント処理
 * @param {L.LeafletMouseEvent} e - Leafletマウスイベント
 * @param {L.Marker} marker - クリックされたマーカー
 * @returns {void}
 */
function handleMarkerClick(e, marker) {
    // イベントの伝播を停止
    L.DomEvent.stopPropagation(e);

    // マーカーを削除
    map.removeLayer(marker);
    MarkerState.current = null;

    // 情報パネルを非表示
    closeInfoPanel();
}

/**
 * 赤マーカーのクリックイベント処理
 * @param {L.LeafletMouseEvent} e - Leafletマウスイベント
 * @param {L.Marker} marker - クリックされたマーカー
 * @param {Object} markerInfo - マーカー情報オブジェクト
 * @returns {Promise<void>}
 */
async function handleRedMarkerClick(e, marker, markerInfo) {
    // イベントの伝播を停止
    L.DomEvent.stopPropagation(e);

    // 現在のマーカーが同じマーカーの場合
    if (
        MarkerState.currentOpenRed === marker &&
        PanelState.isRedPinInfoOpen
    ) {
        // 情報パネルを閉じる
        closeInfoPanel();
        marker.closePopup();
        return;
    }

    try {
        // 通常マーカーが開いている場合は削除
        if (PanelState.isInfoOpen && MarkerState.current) {
            map.removeLayer(MarkerState.current);
            MarkerState.current = null;
        }

        // マーカー情報を更新（IDも含めて渡す）
        const updatedMarkerInfo = await getMarkerInfo(
            markerInfo.lat,
            markerInfo.lon,
            markerInfo.name,
            marker.customId || markerInfo.id // マーカーに保存されたIDまたは元のIDを使用
        );

        if (updatedMarkerInfo) {
            console.log('更新されたマーカー情報:', updatedMarkerInfo);

            // ポップアップ内容を更新
            marker.setPopupContent(updatedMarkerInfo.popupContent);

            // ポップアップを開く
            marker.openPopup();

            // 情報パネルを表示
            await showInfoPanel(updatedMarkerInfo);

            // 状態を更新
            PanelState.isRedPinInfoOpen = true;
            PanelState.isInfoOpen = false;
            MarkerState.currentOpenRed = marker;
        }
    } catch (error) {
        console.error('赤マーカークリック処理中にエラーが発生しました:', error);
    }
}

/**
 * CSVファイルからマーカーを読み込む
 * @returns {void}
 */
function loadCSVMarkers() {
    // マーカー機能またはCSVインポート機能が無効な場合は何もしない
    if (
        !isFeatureEnabled('markers.enabled') ||
        !isFeatureEnabled('markers.csvImport')
    ) {
        return;
    }

    // ファイル選択用の入力要素を作成
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    fileInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        console.log('[Marker] CSV読み込み:', file.name);

        const reader = new FileReader();
        reader.onload = function (e) {
            const csvData = e.target.result;
            const markers = Utils.parseCSV(csvData);
            console.log(`[Marker] CSVマーカー追加: ${markers.length}件`);
            addMarkersToMap(markers);
        };
        reader.readAsText(file);
    });

    fileInput.click();
}

/**
 * マーカーをマップに追加する
 * @param {Array<{lat: number, lon: number, name: string, id: string}>} markers - マーカーデータの配列
 * @returns {Promise<void>}
 */
async function addMarkersToMap(markers) {
    for (const markerData of markers) {
        try {
            await createMarker(
                markerData.lat,
                markerData.lon,
                markerData.name,
                true,
                markerData.id
            );
        } catch (error) {
            console.error('マーカー作成エラー:', markerData, error);
        }
    }
}
