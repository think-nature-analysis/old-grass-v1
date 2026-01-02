// レイヤー関連の機能

// ラスターレイヤーの状態管理
const LayerState = {
    loaded: {}, // 読み込まれたレイヤーを保持するオブジェクト
    active: [], // 現在アクティブなレイヤーのIDを保持する配列（最大2つ）
    colorMaps: {}, // レイヤーごとのカラーマップ設定
    valueRange: {}, // レイヤーごとの値範囲設定
    colorbarElements: {}, // カラーバー要素を保持するオブジェクト
};

// ===== メイン処理：設定を読み込んでレイヤーを初期化 =====

/**
 * レイヤー設定を読み込む
 * @returns {Promise<Object|undefined>} レイヤー設定オブジェクト
 */
async function loadLayerConfig() {
    console.log('[Raster] レイヤー設定読み込み開始');
    try {
        // 設定ファイルを読み込む
        const response = await fetch(AppConstants.urls.layersConfig);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const config = await response.json();
        console.log(`[Raster] レイヤー設定読み込み完了: ${config.layers.length}件`);

        // レイヤー選択UIを表示
        if (isFeatureEnabled('rasterLayers.layerSelectionPanel')) {
            buildLayerSelectionUI(config.layers);
        }

        // 起動時に最初のレイヤーを自動で読み込む
        loadInitialLayer(config);

        return config;
    } catch (error) {
        console.error('[Raster] レイヤー設定の読み込みに失敗:', error);
        alert('レイヤー設定の読み込みに失敗しました。');
    }
}

// ===== 起動時の初期レイヤー読み込み =====

/**
 * 初期レイヤーを読み込む
 * @param {Object} config - レイヤー設定オブジェクト
 * @returns {void}
 */
function loadInitialLayer(config) {
    // 設定で無効化されている場合は何もしない
    if (!projectConfig || !isFeatureEnabled('rasterLayers.initmap')) {
        return;
    }

    const rasterLayers = config.layers.filter(
        (layer) => layer.type === 'raster'
    );

    if (rasterLayers.length === 0) {
        return;
    }

    const firstLayer = rasterLayers[0];
    console.log('[Raster] 初期レイヤー表示:', firstLayer.id);

    // UIがある場合はチェックボックスを操作、ない場合は直接読み込み
    if (isFeatureEnabled('rasterLayers.layerSelectionPanel')) {
        // チェックボックスにチェックを入れる
        setTimeout(() => {
            const checkbox = document.getElementById(`layer-${firstLayer.id}`);
            if (checkbox) {
                checkbox.checked = true;
                checkbox.dispatchEvent(new Event('change'));
            }
        }, 100);
    } else {
        // UIなしで直接レイヤーを読み込む
        loadLayerDirectly(firstLayer);
    }
}

// ===== UIなしでレイヤーを読み込む =====
async function loadLayerDirectly(layerConfig) {
    try {
        showLoadingIndicator(layerConfig.id);

        const layer = await loadLayer(layerConfig.id);

        // アクティブレイヤーリストに追加
        if (!LayerState.active.includes(layerConfig.id)) {
            LayerState.active.push(layerConfig.id);
        }

        updateLayerSettingsUI();

        // カラーバーを表示
        const georaster = layer.georasters[0];
        const colormap =
            LayerState.colorMaps[layerConfig.id] || layerConfig.defaultColormap;

        LayerState.valueRange[layerConfig.id] = {
            min: georaster.mins[0],
            max: georaster.maxs[0],
        };

        addColorbar(
            LayerState.valueRange[layerConfig.id].min,
            LayerState.valueRange[layerConfig.id].max,
            layerConfig.name,
            colormap,
            layerConfig.id
        );

        hideLoadingIndicator(layerConfig.id);
    } catch (error) {
        console.error(
            `初期レイヤー ${layerConfig.id} の読み込みに失敗しました:`,
            error
        );
        hideLoadingIndicator(layerConfig.id);
        ErrorHandler.showUserError(
            `レイヤー ${layerConfig.name} の読み込みに失敗しました。`
        );
    }
}

/**
 * レイヤー選択UIを構築する
 * @param {Array<Object>} layers - レイヤー設定の配列
 * @returns {void}
 */
function buildLayerSelectionUI(layers) {
    // プロジェクト設定でラスターレイヤーが無効な場合は何もしない
    if (
        !isFeatureEnabled('rasterLayers.enabled') ||
        !isFeatureEnabled('rasterLayers.layerSelectionPanel')
    ) {
        return;
    }

    const layerList = document.getElementById('layerList');
    // ラスターレイヤーのみをフィルタリング
    const rasterLayers = layers.filter(
        (layer) =>
            layer.url && /\.(tif|tiff|png|jpg|jpeg|geotiff)$/i.test(layer.url)
    );

    // 既存の内容をクリア
    layerList.innerHTML = '';

    // レイヤーリストを作成
    rasterLayers.forEach((layer) => {
        // レイヤー選択項目を作成
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `layer-${layer.id}`;
        checkbox.value = layer.id;
        checkbox.dataset.name = layer.name;
        checkbox.addEventListener('change', handleLayerSelection);

        const label = document.createElement('label');
        label.htmlFor = `layer-${layer.id}`;
        label.textContent = layer.name;

        layerItem.appendChild(checkbox);
        layerItem.appendChild(label);
        layerList.appendChild(layerItem);

        // 状態を初期化
        LayerState.colorMaps[layer.id] = layer.defaultColormap;
        LayerState.valueRange[layer.id] = { min: 0, max: 1 };
    });
}

// レイヤー選択の処理
function handleLayerSelection(e) {
    const layerId = e.target.value;
    const layerName = e.target.dataset.name;
    const isChecked = e.target.checked;

    if (isChecked) {
        console.log(`[Raster] レイヤー選択: ${layerName}`);

        // 現在選択されているレイヤー数を確認
        const currentSelectedLayers = document.querySelectorAll(
            '#layerList input[type="checkbox"]:checked'
        );

        // 最大選択数を超える場合は選択を解除
        if (currentSelectedLayers.length > AppConstants.layers.maxSelectable) {
            e.target.checked = false;
            alert(
                `レイヤーは最大${AppConstants.layers.maxSelectable}つまで選択できます。`
            );
            return;
        }

        // ローディングインジケータを表示
        showLoadingIndicator(layerId);

        // レイヤーを読み込み
        loadLayer(layerId)
            .then((layer) => {
                // ローディングインジケータを非表示
                hideLoadingIndicator(layerId);

                // アクティブレイヤーリストに追加
                if (!LayerState.active.includes(layerId)) {
                    LayerState.active.push(layerId);
                }

                // レイヤー設定UIを更新
                updateLayerSettingsUI();

                // レイヤー設定を取得してカラーバーを表示
                Utils.getLayerConfig(layerId).then((layerConfig) => {
                    if (layerConfig) {
                        const georaster = layer.georasters[0];

                        // 値範囲が未設定の場合は初期化
                        if (!LayerState.valueRange[layerId]) {
                            LayerState.valueRange[layerId] = {
                                min: georaster.mins[0],
                                max: georaster.maxs[0],
                            };
                        }

                        const colormap =
                            LayerState.colorMaps[layerId] ||
                            layerConfig.defaultColormap;

                        // カラーバーを表示
                        addColorbar(
                            LayerState.valueRange[layerId].min,
                            LayerState.valueRange[layerId].max,
                            layerConfig.name,
                            colormap,
                            layerId
                        );
                    }
                });
            })
            .catch((error) => {
                // エラー時の処理
                console.error(
                    `レイヤー ${layerId} の読み込みに失敗しました:`,
                    error
                );

                // ローディングインジケータを非表示
                hideLoadingIndicator(layerId);

                // チェックボックスを元に戻す
                e.target.checked = false;

                // エラーメッセージを表示
                ErrorHandler.showUserError(
                    `レイヤー ${layerName} の読み込みに失敗しました。ファイルが存在するか確認してください。`
                );
            });
    } else {
        console.log(`[Raster] レイヤー解除: ${layerName}`);

        // レイヤーを非表示にする
        if (LayerState.loaded[layerId] && map.hasLayer(LayerState.loaded[layerId])) {
            map.removeLayer(LayerState.loaded[layerId]);
        }

        // カラーバーを削除
        removeAllColorbarsByLayerId(layerId);

        // アクティブレイヤーリストから削除
        const index = LayerState.active.indexOf(layerId);
        if (index > -1) {
            LayerState.active.splice(index, 1);
        }

        // レイヤー設定UIを更新
        updateLayerSettingsUI();

        // 残りのカラーバーの位置を更新
        updateColorbarPositions();
    }
}

// レイヤー設定UIを更新
function updateLayerSettingsUI() {
    // プロジェクト設定でレイヤー設定UIが無効な場合は何もしない
    if (
        !isFeatureEnabled('rasterLayers.enabled') ||
        !isFeatureEnabled('rasterLayers.layerSettingsUI')
    ) {
        return;
    }

    // レイヤー1の設定パネル
    const layer1Settings = document.getElementById('layer1Settings');
    const layer1Name = document.getElementById('layer1Name');

    // レイヤー2の設定パネル
    const layer2Settings = document.getElementById('layer2Settings');
    const layer2Name = document.getElementById('layer2Name');

    // 両方のパネルを一旦非表示
    layer1Settings.style.display = 'none';
    layer2Settings.style.display = 'none';

    // アクティブなレイヤーがある場合、設定パネルを表示
    if (LayerState.active.length > 0) {
        const layer1Id = LayerState.active[0];
        layer1Name.textContent = document.querySelector(
            `#layer-${layer1Id}`
        ).dataset.name;
        layer1Settings.style.display = 'block';

        // レイヤー1のスライダー設定を更新
        updateLayerSliders(layer1Id, 1);

        // レイヤー1のカラーマップ設定を更新
        updateLayerColormap(layer1Id, 1);
    }

    if (LayerState.active.length > 1) {
        const layer2Id = LayerState.active[1];
        layer2Name.textContent = document.querySelector(
            `#layer-${layer2Id}`
        ).dataset.name;
        layer2Settings.style.display = 'block';

        // レイヤー2のスライダー設定を更新
        updateLayerSliders(layer2Id, 2);

        // レイヤー2のカラーマップ設定を更新
        updateLayerColormap(layer2Id, 2);
    }
}

// レイヤーのスライダー設定を更新
function updateLayerSliders(layerId, panelIndex) {
    const layer = LayerState.loaded[layerId];
    if (!layer || !layer.georasters) return;

    const georaster = layer.georasters[0];
    const min = georaster.mins[0];
    const max = georaster.maxs[0];

    // スライダー要素の取得
    const minSlider = document.getElementById(`layer${panelIndex}Min`);
    const maxSlider = document.getElementById(`layer${panelIndex}Max`);
    const minDisplay = document.getElementById(`layer${panelIndex}MinDisplay`);
    const maxDisplay = document.getElementById(`layer${panelIndex}MaxDisplay`);

    // スライダーの範囲を設定
    minSlider.min = min;
    minSlider.max = max;
    maxSlider.min = min;
    maxSlider.max = max;

    // 値範囲が未設定の場合は初期化
    if (!LayerState.valueRange[layerId]) {
        // レイヤーの実際の最小値と最大値を使用
        LayerState.valueRange[layerId] = { min: min, max: max };
    }

    // スライダーの値を設定
    minSlider.value = LayerState.valueRange[layerId].min;
    maxSlider.value = LayerState.valueRange[layerId].max;

    // 表示値を更新
    minDisplay.textContent = LayerState.valueRange[layerId].min.toFixed(2);
    maxDisplay.textContent = LayerState.valueRange[layerId].max.toFixed(2);

    // データ属性にレイヤーIDを設定
    minSlider.dataset.layerId = layerId;
    maxSlider.dataset.layerId = layerId;
}

// レイヤーのカラーマップ設定を更新
function updateLayerColormap(layerId, panelIndex) {
    // カラーマップ選択要素の取得
    const colorMapSelect = document.getElementById(
        `layer${panelIndex}Colormap`
    );
    const reverseCheckbox = document.getElementById(
        `layer${panelIndex}Reverse`
    );

    // レイヤー設定を取得
    Utils.getLayerConfig(layerId).then((layerConfig) => {
        if (!layerConfig) return;

        // カラーマップを設定
        colorMapSelect.value =
            LayerState.colorMaps[layerId] || layerConfig.defaultColormap;
        reverseCheckbox.checked = false; // デフォルトは反転なし

        // データ属性にレイヤーIDを設定
        colorMapSelect.dataset.layerId = layerId;
        reverseCheckbox.dataset.layerId = layerId;

        // 透明度スライダーの設定
        const opacitySlider = document.getElementById(
            `layer${panelIndex}Opacity`
        );
        opacitySlider.value = LayerState.loaded[layerId].options.opacity;
        opacitySlider.dataset.layerId = layerId;
    });
}

/**
 * レイヤーを読み込む
 * @param {string} layerId - レイヤーID
 * @returns {Promise<void>}
 */
function loadLayer(layerId) {
    // 既に読み込まれている場合はそれを使用
    if (LayerState.loaded[layerId]) {
        console.log(`[Raster] レイヤー再表示: ${layerId}`);
        if (!map.hasLayer(LayerState.loaded[layerId])) {
            LayerState.loaded[layerId].addTo(map);

            // レイヤー設定を取得してカラーバーを表示
            Utils.getLayerConfig(layerId).then((layerConfig) => {
                if (layerConfig) {
                    const georaster = LayerState.loaded[layerId].georasters[0];
                    const min = georaster.mins[0];
                    const max = georaster.maxs[0];

                    // 値範囲が未設定の場合のみ初期化
                    if (!LayerState.valueRange[layerId]) {
                        LayerState.valueRange[layerId] = { min: min, max: max };
                    }

                    const colormap =
                        LayerState.colorMaps[layerId] ||
                        layerConfig.defaultColormap;

                    // カラーバーを表示
                    addColorbar(
                        LayerState.valueRange[layerId].min,
                        LayerState.valueRange[layerId].max,
                        layerConfig.name,
                        colormap,
                        layerId
                    );
                }
            });
        }
        return Promise.resolve(LayerState.loaded[layerId]);
    }

    // レイヤー設定を取得
    return fetch(AppConstants.urls.layersConfig)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then((config) => {
            const layerConfig = config.layers.find(
                (layer) => layer.id === layerId
            );
            if (!layerConfig) {
                throw new Error(`レイヤー ${layerId} の設定が見つかりません。`);
            }

            // レイヤーを読み込む
            return fetch(layerConfig.url)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(
                            `HTTP error! status: ${response.status}`
                        );
                    }
                    return response.arrayBuffer();
                })
                .then((arrayBuffer) => {
                    return parseGeoraster(arrayBuffer).then((georaster) => {
                        const min = georaster.mins[0];
                        const max = georaster.maxs[0];

                        // 値範囲を初期化（レイヤーの実際の最小値と最大値を使用）
                        if (!LayerState.colorMaps[layerId]) {
                            LayerState.colorMaps[layerId] =
                                layerConfig.defaultColormap;
                        }

                        // 常にレイヤーの実際の最小値と最大値を初期値として設定
                        LayerState.valueRange[layerId] = { min: min, max: max };

                        // ピクセル値から色への変換関数
                        const pixelValuesToColorFn = function (pixelValues) {
                            const pixelValue = pixelValues[0];
                            if (
                                pixelValue === null ||
                                pixelValue === undefined ||
                                isNaN(pixelValue)
                            )
                                return null;

                            // 現在の値範囲を使用
                            const currentMin = LayerState.valueRange[layerId].min;
                            const currentMax = LayerState.valueRange[layerId].max;
                            const currentRange = currentMax - currentMin;

                            // 値がカスタムレンジ内かチェック
                            if (pixelValue < currentMin) {
                                // 最小値未満はカラーマップの最小値側の色を使用
                                const [r, g, b] = evaluate_cmap(
                                    0,
                                    LayerState.colorMaps[layerId],
                                    true
                                );
                                return `rgb(${r}, ${g}, ${b})`;
                            }
                            if (pixelValue > currentMax) {
                                // 最大値超過はカラーマップの最大値側の色を使用
                                const [r, g, b] = evaluate_cmap(
                                    1,
                                    LayerState.colorMaps[layerId],
                                    true
                                );
                                return `rgb(${r}, ${g}, ${b})`;
                            }

                            // カスタムレンジ内の値をスケーリング
                            const scaledValue =
                                (pixelValue - currentMin) / currentRange;
                            const [r, g, b] = evaluate_cmap(
                                scaledValue,
                                LayerState.colorMaps[layerId],
                                true
                            );
                            return `rgb(${r}, ${g}, ${b})`;
                        };

                        const layer = new GeoRasterLayer({
                            georaster: georaster,
                            opacity: layerConfig.defaultOpacity,
                            pixelValuesToColorFn: pixelValuesToColorFn,
                            resolution: 256,
                        });

                        // レイヤーをマップに追加
                        layer.addTo(map);

                        // 読み込まれたレイヤーを保存
                        LayerState.loaded[layerId] = layer;

                        console.log(`[Raster] レイヤー読み込み完了: ${layerId}`);

                        return layer;
                    });
                });
        });
}

// ラスターレイヤーのローディングインジケータを表示する関数
function showLoadingIndicator(layerId) {
    const checkbox = document.getElementById(`layer-${layerId}`);
    if (!checkbox) return;

    const layerItem = checkbox.closest('.layer-item');
    Utils.showLoadingIndicator(layerItem);
}

// ラスターレイヤーのローディングインジケータを非表示にする関数
function hideLoadingIndicator(layerId) {
    const checkbox = document.getElementById(`layer-${layerId}`);
    if (!checkbox) return;

    const layerItem = checkbox.closest('.layer-item');
    Utils.hideLoadingIndicator(layerItem);
}


// レイヤーのスタイルを更新する関数
function updateLayerStyle(
    layer,
    colormap,
    reverse,
    minValue,
    maxValue,
    layerId
) {
    if (!layer) return;

    // 既存のレイヤーを使用して新しいピクセル値→色の変換関数を設定
    const georaster = layer.georasters[0];
    const opacity = layer.options.opacity;

    // 新しいレイヤーを作成
    const newLayer = new GeoRasterLayer({
        georaster: georaster,
        opacity: opacity,
        pixelValuesToColorFn: function (pixelValues) {
            const pixelValue = pixelValues[0];
            if (
                pixelValue === null ||
                pixelValue === undefined ||
                isNaN(pixelValue)
            )
                return null;

            // 値がカスタムレンジ外の場合
            if (pixelValue < minValue) {
                // 最小値未満はカラーマップの最小値側の色を使用
                const [r, g, b] = reverse
                    ? evaluate_cmap(0, colormap, false)
                    : evaluate_cmap(0, colormap, true);
                return `rgb(${r}, ${g}, ${b})`;
            }
            if (pixelValue > maxValue) {
                // 最大値超過はカラーマップの最大値側の色を使用
                const [r, g, b] = reverse
                    ? evaluate_cmap(1, colormap, false)
                    : evaluate_cmap(1, colormap, true);
                return `rgb(${r}, ${g}, ${b})`;
            }

            // カスタムレンジ内の値をスケーリング
            const scaledPixelValue =
                (pixelValue - minValue) / (maxValue - minValue);
            const [r, g, b] = reverse
                ? evaluate_cmap(scaledPixelValue, colormap, false)
                : evaluate_cmap(scaledPixelValue, colormap, true);
            return `rgb(${r}, ${g}, ${b})`;
        },
        resolution: 256,
    });

    // 新しいレイヤーをマップに追加
    newLayer.addTo(map);

    // 古いレイヤーを削除
    map.removeLayer(layer);

    // レイヤーを更新
    LayerState.loaded[layerId] = newLayer;

    // 古いカラーバーを削除してから新しいカラーバーを追加
    removeAllColorbarsByLayerId(layerId);

    // レイヤーがアクティブな場合のみカラーバーを更新
    if (LayerState.active.includes(layerId)) {
        updateColorbar(minValue, maxValue, layerId, colormap, reverse);
    }

    return newLayer;
}

// 特定のレイヤーIDに関連するすべてのカラーバーを削除する関数
function removeAllColorbarsByLayerId(layerId) {
    // クラス名に基づいて要素を検索
    const colorbarElems = document.querySelectorAll(`.colorbar-${layerId}`);
    colorbarElems.forEach((element) => {
        element.remove();
    });

    // ID属性に基づいて要素を検索
    const colorbarById = document.getElementById(`colorbar-${layerId}`);
    if (colorbarById) {
        colorbarById.remove();
    }

    // グローバルオブジェクトからも削除
    if (LayerState.colorbarElements[layerId]) {
        delete LayerState.colorbarElements[layerId];
    }
}

// レイヤーの透明度を更新する関数
function updateOpacity(e) {
    const layerId = e.target.dataset.layerId;
    const opacity = parseFloat(e.target.value);

    if (LayerState.loaded[layerId]) {
        LayerState.loaded[layerId].setOpacity(opacity);
    }
}

// スライダー値変更の処理
function handleSliderChange(e) {
    const layerId = e.target.dataset.layerId;
    const panelIndex = LayerState.active.indexOf(layerId) + 1;
    const sliderId = e.target.id;
    const value = parseFloat(e.target.value);

    // 値表示を更新
    document.getElementById(
        `layer${panelIndex}${sliderId.includes('Min') ? 'Min' : 'Max'}Display`
    ).textContent = value.toFixed(2);

    // 値範囲を更新
    if (!LayerState.valueRange[layerId]) {
        LayerState.valueRange[layerId] = { min: 0, max: 1 };
    }

    if (sliderId.includes('Min')) {
        LayerState.valueRange[layerId].min = value;
    } else {
        LayerState.valueRange[layerId].max = value;
    }

    // レイヤー更新
    const colorMapSelect = document.getElementById(
        `layer${panelIndex}Colormap`
    );
    const reverseCheckbox = document.getElementById(
        `layer${panelIndex}Reverse`
    );

    const selectedColorMap = colorMapSelect.value;
    const reverseColorMap = reverseCheckbox.checked;
    const minValue = LayerState.valueRange[layerId].min;
    const maxValue = LayerState.valueRange[layerId].max;

    // レイヤーがアクティブな場合のみスタイルを更新
    if (LayerState.active.includes(layerId)) {
        updateLayerStyle(
            LayerState.loaded[layerId],
            selectedColorMap,
            reverseColorMap,
            minValue,
            maxValue,
            layerId
        );
    }
}

// カラーバーDOM要素を生成する共通関数
function createColorbarElement(min, max, layerName, colormap, reverse, layerId) {
    // カラーグラデーション用のCanvasを作成
    const colorbarCanvas = document.createElement('canvas');
    colorbarCanvas.width = 140;
    colorbarCanvas.height = 20;
    const ctx = colorbarCanvas.getContext('2d');

    // カラーマップに基づいてグラデーションを描画
    for (let i = 0; i < 140; i++) {
        const [r, g, b] = reverse
            ? evaluate_cmap(i / 139, colormap, false)
            : evaluate_cmap(i / 139, colormap, true);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(i, 0, 1, 20);
    }

    // コントロールパネルの位置とサイズを取得
    const controlsElement = document.getElementById('controls');
    const controlsRect = controlsElement.getBoundingClientRect();

    // レイヤーの位置インデックスを決定（LayerState.active配列内の位置ではなく、固定位置）
    // 常に最初のレイヤーは上、2番目のレイヤーは下に表示
    const positionIndex =
        LayerState.active.length === 1 ? 0 : LayerState.active[0] === layerId ? 0 : 1;

    // カラーバーをコントロールパネルの右側に配置
    const colorbarContainer = document.createElement('div');
    colorbarContainer.className = `colorbar-${layerId}`;
    colorbarContainer.id = `colorbar-${layerId}`;
    colorbarContainer.dataset.position = positionIndex.toString(); // 位置情報を保存
    colorbarContainer.style.cssText = `
        position: absolute;
        top: ${controlsRect.top + positionIndex * 115}px;
        left: ${controlsRect.right + 10}px;
        padding: 5px;
        border-radius: 5px;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        width: 140px;
        background-color: white;
        z-index: 1000;
    `;

    colorbarContainer.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">${layerName}</div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
            <span>${min.toFixed(2)}</span>
            <span>${max.toFixed(2)}</span>
        </div>
    `;

    colorbarContainer.appendChild(colorbarCanvas);
    return colorbarContainer;
}

// カラーバーを追加する関数（初回表示時）
function addColorbar(min, max, layerName, colormap, layerId) {
    // 既存のカラーバーを削除
    removeAllColorbarsByLayerId(layerId);

    // 反転設定を取得
    const panelIndex = LayerState.active.indexOf(layerId) + 1;
    const reverseCheckbox = document.getElementById(`layer${panelIndex}Reverse`);
    const reverse = reverseCheckbox ? reverseCheckbox.checked : false;

    // カラーバー要素を生成してDOMに追加
    const colorbarContainer = createColorbarElement(min, max, layerName, colormap, reverse, layerId);
    document.body.appendChild(colorbarContainer);

    // カラーバー要素を保存
    LayerState.colorbarElements[layerId] = colorbarContainer;

    // カラーバーの位置を更新
    updateColorbarPositions();
}

// カラーバーを更新する関数（設定変更時）
function updateColorbar(min, max, layerId, colormap, reverse) {
    // 既存のカラーバーを削除
    removeAllColorbarsByLayerId(layerId);

    // レイヤー設定を取得
    Utils.getLayerConfig(layerId).then((layerConfig) => {
        if (!layerConfig) return;

        // カラーバー要素を生成してDOMに追加
        const colorbarContainer = createColorbarElement(min, max, layerConfig.name, colormap, reverse, layerId);
        document.body.appendChild(colorbarContainer);

        // カラーバー要素を保存
        LayerState.colorbarElements[layerId] = colorbarContainer;

        // カラーバーの位置を更新
        updateColorbarPositions();
    });
}

// すべてのカラーバーの位置を更新する関数
function updateColorbarPositions() {
    // コントロールパネルの位置とサイズを取得
    const controlsElement = document.getElementById('controls');
    const controlsRect = controlsElement.getBoundingClientRect();

    // アクティブなレイヤーごとにカラーバーの位置を更新
    LayerState.active.forEach((layerId, index) => {
        const colorbar = document.getElementById(`colorbar-${layerId}`);
        if (colorbar) {
            // 位置インデックスを取得（固定位置を維持）
            const positionIndex = index; // LayerState.active内の順序を使用

            // 位置を更新
            colorbar.style.top = `${controlsRect.top + positionIndex * 115}px`;
            colorbar.dataset.position = positionIndex.toString();
        }
    });
}

/**
 * レイヤー管理を初期化する（main.jsから呼び出される）
 * @returns {void}
 */
function initLayers() {
    // レイヤー設定を読み込み
    loadLayerConfig();

    // レイヤー設定UIのイベントリスナーを設定（layer1, layer2共通）
    for (let panelIndex = 1; panelIndex <= 2; panelIndex++) {
        const colorMapSelect = document.getElementById(`layer${panelIndex}Colormap`);
        const reverseCheckbox = document.getElementById(`layer${panelIndex}Reverse`);
        const opacitySlider = document.getElementById(`layer${panelIndex}Opacity`);
        const minSlider = document.getElementById(`layer${panelIndex}Min`);
        const maxSlider = document.getElementById(`layer${panelIndex}Max`);

        // カラーマップ変更時のハンドラ
        colorMapSelect.addEventListener('change', () => {
            const layerId = colorMapSelect.dataset.layerId;
            if (!layerId) return;

            const selectedColorMap = colorMapSelect.value;
            console.log(`[Raster] カラーマップ変更: ${layerId} -> ${selectedColorMap}`);

            const reverseColorMap = reverseCheckbox.checked;
            const minValue = parseFloat(minSlider.value);
            const maxValue = parseFloat(maxSlider.value);

            LayerState.colorMaps[layerId] = selectedColorMap;
            updateLayerStyle(
                LayerState.loaded[layerId],
                selectedColorMap,
                reverseColorMap,
                minValue,
                maxValue,
                layerId
            );
        });

        // 反転チェック変更時のハンドラ
        reverseCheckbox.addEventListener('change', () => {
            const layerId = reverseCheckbox.dataset.layerId;
            if (!layerId) return;

            const selectedColorMap = colorMapSelect.value;
            const reverseColorMap = reverseCheckbox.checked;
            const minValue = parseFloat(minSlider.value);
            const maxValue = parseFloat(maxSlider.value);

            updateLayerStyle(
                LayerState.loaded[layerId],
                selectedColorMap,
                reverseColorMap,
                minValue,
                maxValue,
                layerId
            );
        });

        // 透過度・最小/最大値のリスナー
        opacitySlider.addEventListener('input', updateOpacity);
        minSlider.addEventListener('input', handleSliderChange);
        maxSlider.addEventListener('input', handleSliderChange);
    }
}
