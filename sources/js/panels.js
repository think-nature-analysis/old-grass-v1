// パネルの状態管理
const PanelState = {
    isInfoOpen: false,
    isRedPinInfoOpen: false,
    currentLoadingToken: null,
    activeAbortControllers: new Map(),
    currentModalContent: {
        // モーダルウィンドウのコンテンツ情報
        tab1: null,
        tab2: null,
        tab3: null,
    },
};


// ===== PanelStateを操作する公開関数 =====

/**
 * パネルの開閉状態を更新する
 * @param {boolean} isInfoOpen - 情報パネルが開いているか
 * @param {boolean} isRedPinInfoOpen - 赤ピン情報パネルが開いているか
 * @returns {void}
 */
function setPanelOpenState(isInfoOpen, isRedPinInfoOpen) {
    PanelState.isInfoOpen = isInfoOpen;
    PanelState.isRedPinInfoOpen = isRedPinInfoOpen;
}

/**
 * 新しいローディングトークンを作成する
 * @returns {{canceled: boolean}} ローディングトークン
 */
function createLoadingToken() {
    PanelState.currentLoadingToken = { canceled: false };
    return PanelState.currentLoadingToken;
}

/**
 * 現在のローディングトークンをキャンセルする
 * @returns {void}
 */
function cancelCurrentLoading() {
    if (PanelState.currentLoadingToken) {
        PanelState.currentLoadingToken.canceled = true;
    }
}

/**
 * 現在のローディングトークンを取得する
 * @returns {{canceled: boolean}|null} ローディングトークン
 */
function getCurrentLoadingToken() {
    return PanelState.currentLoadingToken;
}


// ===== ヘルパー関数 =====

/**
 * 位置コード情報をHTML形式で整形する
 * @param {string|null} value - 位置コード値
 * @param {string} label - ラベル
 * @returns {string} HTML文字列
 */
function formatLocationCode(value, label) {
    const displayValue =
        value && value !== 'Out of Range' ? value : 'Out of Range';
    return `<p><strong>${label}:</strong> ${displayValue}</p>`;
}

/**
 * フォールバック画像のパスを取得する
 * @param {string} [imageType='noimage'] - 画像タイプ ('noimage' または 'timeout')
 * @returns {string} 画像パス
 */
function getFallbackImagePath(imageType = 'noimage') {
    if (imageType === 'timeout') {
        return (
            projectConfig?.features?.detailPanel?.timeoutImage ||
            '../default_img/timeout_image.png'
        );
    }
    return (
        projectConfig?.features?.detailPanel?.fallbackImage ||
        '../default_img/noimage1.png'
    );
}

/**
 * 画像モードへのフォールバック処理
 * @param {HTMLElement} container - コンテナ要素
 * @param {string} imageId - 画像要素のID
 * @param {string} [imageType='noimage'] - 画像タイプ
 * @returns {void}
 */
function fallbackToImage(container, imageId, imageType = 'noimage') {
    // 既存のiframeを削除
    const existingIframe = container.querySelector('iframe');
    if (existingIframe) {
        existingIframe.remove();
    }

    // コンテナに画像要素を追加
    const imgElement = document.createElement('img');
    imgElement.id = imageId;
    imgElement.className = 'tab-info1 tab-info2 tab-info3';
    imgElement.style.maxWidth = '100%';
    imgElement.style.height = 'auto';
    imgElement.style.marginTop = '10px';

    container.appendChild(imgElement);

    // 画像モードで表示（imageTypeに応じたフォールバック画像を使用）
    const image = document.getElementById(imageId);
    const fallbackImage = getFallbackImagePath(imageType);
    image.src = fallbackImage + '?' + Date.now();
    image.style.display = 'block';
}

/**
 * 情報パネルを表示する
 * @param {Object} markerInfo - マーカー情報オブジェクト
 * @param {{canceled: boolean}|null} [loadingToken=null] - ローディングトークン
 * @returns {Promise<void>}
 */
async function showInfoPanel(markerInfo, loadingToken = null) {
    try {
        // --- バリデーション ---
        if (loadingToken && loadingToken.canceled) return;

        if (
            !markerInfo ||
            typeof markerInfo.lat !== 'number' ||
            typeof markerInfo.lon !== 'number'
        ) {
            console.error('[Panel] 無効なmarkerInfo:', markerInfo);
            return;
        }

        const infoPanel = document.getElementById('infoPanel');

        // --- パネルヘッダーの更新（タイトル設定） ---
        const title = `${markerInfo.name}`;
        document.getElementById('imageTitle1').textContent = title;
        document.getElementById('imageTitle2').textContent = title;
        document.getElementById('imageTitle3').textContent = title;

        // --- パネルコンテンツの構築（基本情報 + 位置コード） ---
        let infoHTML = `<p><strong>Loc:</strong> ${markerInfo.name}</p>
                       <p><strong>Lat:</strong> ${markerInfo.lat.toFixed(4)}|
                       <strong>Lon:</strong> ${markerInfo.lon.toFixed(4)}</p>`;

        const locationCodeType = markerInfo.locationCodeType || 'worldGrid';

        if (locationCodeType === 'meshCode') {
            infoHTML += formatLocationCode(
                markerInfo.meshcode3,
                'mesh code'
            );
        }

        if (locationCodeType === 'worldGrid') {
            infoHTML += formatLocationCode(
                markerInfo.worldGridKey,
                '世界グリッドキー(10分)'
            );
        }

        document.getElementById('info').innerHTML = infoHTML;

        // モーダルボタンを追加
        addModalButtons();

        // レイヤー名を非同期で更新
        LayerState.active.forEach((layerId) => {
            Utils.getLayerConfig(layerId)
                .then((layerConfig) => {
                    if (layerConfig) {
                        const layerNameElement = document.getElementById(
                            `layer-name-${layerId}`
                        );
                        if (layerNameElement) {
                            layerNameElement.textContent = layerConfig.name;
                        }
                    }
                })
                .catch((error) => {
                    console.error(
                        `レイヤー設定取得エラー (${layerId}):`,
                        error
                    );
                });
        });

        // --- タブコンテンツの読み込み（画像/iframe） ---
        const locationKey = getLocationKey(markerInfo, locationCodeType);

        showTabImage('locationImage1', locationKey, 1, loadingToken, markerInfo);
        showTabImage('locationImage2', locationKey, 2, loadingToken, markerInfo);
        showTabImage('locationImage3', locationKey, 3, loadingToken, markerInfo);

        // --- パネル表示と関連UIの更新 ---
        infoPanel.style.display = 'block';

        // 地図の中心を移動
        setTimeout(() => map.panTo([markerInfo.lat, markerInfo.lon]), 100);

        // 凡例の位置を調整
        if (typeof adjustVectorLegendPosition === 'function') {
            adjustVectorLegendPosition(true);
        }

        // --- 状態の更新 ---
        PanelState.isInfoOpen = true;
    } catch (error) {
        console.error('showInfoPanel エラー:', error);
        // エラー時の処理
        if (loadingToken) {
            loadingToken.canceled = true;
        }
    }
}

/**
 * マーカー情報から位置キーを取得する
 * @param {Object} markerInfo - マーカー情報オブジェクト
 * @param {string} locationCodeType - 位置コードタイプ ('meshCode' または 'worldGrid')
 * @returns {{key: string|null, useIdFolder: boolean}} 位置キー情報
 */
function getLocationKey(markerInfo, locationCodeType) {
    // IDが存在する場合は優先的にそれを使用し、ID使用フラグも返す
    // TODO: 予約語odn_形式にするかは要検討
    if (markerInfo.id) {
        if (!markerInfo.id.startsWith(AppConstants.marker.locationPrefix.ODN)) {
            return {
                key: markerInfo.id,
                useIdFolder: true,
            };
        }
    }

    // IDがない場合は従来の位置コード方式を使用
    let key = null;
    switch (locationCodeType) {
        case 'meshCode':
            key =
                markerInfo.meshcode3 && markerInfo.meshcode3 !== 'Out of Range'
                    ? markerInfo.meshcode3
                    : null;
            break;
        case 'worldGrid':
            key =
                markerInfo.worldGridKey &&
                markerInfo.worldGridKey !== 'Out of Range'
                    ? markerInfo.worldGridKey
                    : null;
            break;
        case 'none':
        default:
            key = null;
            break;
    }
    return {
        key: key,
        useIdFolder: false,
    };
}

/**
 * 情報パネルを非表示にする
 * @returns {void}
 */
function hideInfoPanel() {
    const infoPanel = document.getElementById('infoPanel');
    infoPanel.style.display = 'none';

    adjustVectorLegendPosition(false);
}

/**
 * コンテンツのパスを解決する
 * @param {Object} paths - パス設定オブジェクト
 * @param {{key: string|null, useIdFolder: boolean}} locationKey - 位置キー情報
 * @returns {{basedir: string, baseUrl: string}} 解決されたパス
 */
function resolveContentPaths(paths, locationKey) {
    const useIdFolder = locationKey.useIdFolder;

    return {
        basedir: useIdFolder
            ? (paths.idBasedir || projectConfig?.features?.detailPanel?.idBasedir || '../my_assets/')
            : (paths.basedir || projectConfig?.features?.detailPanel?.basedir || '../img/'),
        baseUrl: useIdFolder
            ? (paths.idBaseUrl || projectConfig?.features?.detailPanel?.idBaseUrl || '../my_assets/')
            : (paths.baseUrl || projectConfig?.features?.detailPanel?.baseUrl || '../html/')
    };
}

/**
 * レイヤーに有効なラスター値があるかチェックする
 * @param {Object|null} markerInfo - マーカー情報オブジェクト
 * @param {string} layerId - レイヤーID
 * @returns {boolean} 有効なラスター値があればtrue
 */
function hasValidRasterValue(markerInfo, layerId) {
    if (!markerInfo?.layerValues) return true;

    let rasterValue = markerInfo.layerValues[layerId];

    // 配列の場合は最初の要素を取得
    if (Array.isArray(rasterValue)) {
        rasterValue = rasterValue[0];
    }

    // null、undefined、NaNは無効な値
    return !(rasterValue === null || rasterValue === undefined ||
             (typeof rasterValue === 'number' && isNaN(rasterValue)));
}

/**
 * タブコンテンツ（画像またはiframe）を表示する
 * @param {string} imageId - 画像要素のID
 * @param {{key: string|null, useIdFolder: boolean}|string|null} [locationKey=null] - 位置キー
 * @param {number} tabNumber - タブ番号
 * @param {{canceled: boolean}|null} [loadingToken=null] - ローディングトークン
 * @param {Object|null} [markerInfo=null] - マーカー情報オブジェクト
 * @returns {Promise<void>}
 */
async function showTabImage(imageId, locationKey = null, tabNumber, loadingToken = null, markerInfo = null) {
    try {
        if (loadingToken?.canceled) return;

        const existingImage = document.getElementById(imageId);
        const container = existingImage.parentElement;

        // 既存のコンテンツをクリア
        container.querySelectorAll('.iframe-loading').forEach(el => el.remove());
        existingImage.style.display = 'none';
        document.getElementById(imageId + '_iframe')?.remove();

        const displayMode = await Utils.getDisplayModeForMarker();

        // locationKeyを正規化
        if (typeof locationKey === 'string' || locationKey === null) {
            locationKey = { key: locationKey, useIdFolder: false };
        }

        // アクティブなレイヤーを逆順で試す（最後に追加されたレイヤーから優先）
        const activeLayerIds = [...LayerState.active].reverse();
        let foundContent = false;

        for (const layerId of activeLayerIds) {
            if (foundContent) break;

            // 有効なラスター値を持つレイヤーのみ検索
            if (!hasValidRasterValue(markerInfo, layerId)) continue;

            const paths = await Utils.getPathsForLayer(layerId);
            const { basedir, baseUrl } = resolveContentPaths(paths, locationKey);

            // 表示モードに応じてコンテンツを検索
            foundContent = displayMode === 'iframe'
                ? await tryShowIframeMode(imageId, baseUrl, locationKey.key, tabNumber, loadingToken, layerId)
                : await tryShowImageMode(imageId, basedir, locationKey.key, tabNumber);
        }

        // どのレイヤーでもコンテンツが見つからなかった場合、フォールバック画像を表示
        if (!foundContent) {
            displayMode === 'iframe'
                ? fallbackToImage(container, imageId)
                : showDefaultImage(imageId);
        }
    } catch (error) {
        ErrorHandler.logError('タブコンテンツ表示中にエラーが発生しました:', error);
    }
}

// 画像モードでコンテンツ表示を試みる
async function tryShowImageMode(imageId, basedir, locationKeyStr, tabNumber) {
    if (!locationKeyStr) return false;

    const imageUrl = `${basedir}${locationKeyStr}_${tabNumber}.png`;

    try {
        // 画像ファイルの存在を確認
        const response = await fetch(imageUrl, {
            method: 'HEAD',
            cache: 'no-cache',
        });

        if (response.ok) {
            console.log(`[Panel] 画像読み込み: タブ${tabNumber}`);
            const image = document.getElementById(imageId);
            image.src = imageUrl + '?' + Date.now();
            image.style.display = 'block';
            return true;
        }
    } catch (error) {
        // 画像が見つからない場合は次のレイヤーを試す
    }

    return false;
}

// iframeモードでコンテンツ表示を試みる
async function tryShowIframeMode(
    imageId,
    baseUrl,
    locationKey,
    tabNumber,
    loadingToken = null,
    layerId = null
) {
    // キャンセルチェック
    if (loadingToken && loadingToken.canceled) return false;
    if (!locationKey) return false;

    const container = document.getElementById(imageId).parentElement;
    const requestKey = `${imageId}_${tabNumber}_${layerId || 'default'}`;

    // 既存のAbortControllerをキャンセル
    if (PanelState.activeAbortControllers.has(requestKey)) {
        PanelState.activeAbortControllers.get(requestKey).abort();
        PanelState.activeAbortControllers.delete(requestKey);
    }

    // iframeURLを生成
    let iframeUrl;
    try {
        const layerConfig = await Utils.getLayerConfig(layerId);
        const urltype =
            layerConfig?.urltype ||
            projectConfig?.features?.detailPanel?.urltype ||
            'raw';

        if (urltype === 'arg') {
            // arg方式：パラメータでデータを渡す
            const urlbase =
                layerConfig?.urlbase ||
                projectConfig?.features?.detailPanel?.urlbase ||
                baseUrl;

            // デフォルトで引数が入っている場合
            iframeUrl = `${urlbase}&arg=${locationKey}&p=${tabNumber}`;
            if (String(locationKey).startsWith(AppConstants.marker.locationPrefix.SPEC)) {
                iframeUrl = `${baseUrl}${locationKey}_${tabNumber}.html`;
            }
        } else {
            // raw方式：従来通りファイル直接指定
            iframeUrl = `${baseUrl}${locationKey}_${tabNumber}.html`;
        }
    } catch (error) {
        console.error('レイヤー設定取得エラー:', error);
        iframeUrl = `${baseUrl}${locationKey}_${tabNumber}.html`;
    }

    // AbortControllerを作成
    const controller = new AbortController();
    PanelState.activeAbortControllers.set(requestKey, controller);

    // タイムアウト処理を設定
    const timeoutId = setTimeout(() => {
        if (!controller.signal.aborted) {
            controller.abort();
        }
    }, AppConstants.panel.contentLoadTimeout);

    try {
        // ファイルの存在確認
        const response = await fetch(iframeUrl, {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-cache',
        });

        clearTimeout(timeoutId);

        // キャンセルチェック
        if (loadingToken && loadingToken.canceled) {
            throw new Error('Cancelled by token');
        }
        if (controller.signal.aborted) {
            throw new Error('Aborted');
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // ファイルが見つかった場合、iframeを作成して表示
        // モーダル用にコンテンツ情報を保存
        PanelState.currentModalContent[`tab${tabNumber}`] = {
            url: iframeUrl,
            title: document.getElementById(`imageTitle${tabNumber}`).textContent,
        };

        // ローディング表示を作成
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'iframe-loading';
        loadingDiv.textContent = '読み込み中...';
        container.appendChild(loadingDiv);

        // iframeを作成して読み込み
        await createAndLoadIframe(
            container,
            imageId,
            iframeUrl,
            tabNumber,
            loadingDiv,
            loadingToken,
            controller.signal
        );

        updateModalButton(tabNumber, true);
        PanelState.activeAbortControllers.delete(requestKey);
        return true;

    } catch (error) {
        // ファイルが見つからないか、タイムアウトした場合
        clearTimeout(timeoutId);
        PanelState.activeAbortControllers.delete(requestKey);
        return false;
    }
}

// デフォルト画像を表示する関数
function showDefaultImage(imageId) {
    const image = document.getElementById(imageId);
    const fallbackImage = getFallbackImagePath();

    image.src = fallbackImage + '?' + Date.now();
    image.style.display = 'block';
}

// iframe作成と読み込み処理
function createAndLoadIframe(
    container,
    imageId,
    iframeUrl,
    tabNumber,
    loadingDiv,
    loadingToken = null,
    abortSignal = null
) {
    return new Promise((resolve, reject) => {
        // キャンセルチェック
        if (loadingToken && loadingToken.canceled) {
            reject(new Error('Cancelled by token'));
            return;
        }
        if (abortSignal && abortSignal.aborted) {
            reject(new Error('Aborted'));
            return;
        }

        // iframe要素を作成
        const iframe = document.createElement('iframe');
        iframe.id = imageId + '_iframe';
        iframe.src = iframeUrl;
        iframe.style.width = '100%';
        iframe.style.height = 'auto';
        iframe.style.minHeight = '400px';
        iframe.style.border = 'none';
        iframe.style.display = 'none';

        // セキュリティ設定
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        iframe.setAttribute('title', `詳細情報 - タブ${tabNumber}`);

        let isCompleted = false;

        // iframeの読み込み完了時
        iframe.onload = function () {
            if (isCompleted) return;
            isCompleted = true;

            // キャンセルチェック
            if (loadingToken && loadingToken.canceled) {
                reject(new Error('Cancelled by token'));
                return;
            }
            if (abortSignal && abortSignal.aborted) {
                reject(new Error('Aborted'));
                return;
            }

            loadingDiv.remove();
            iframe.style.display = 'block';
            resolve();
        };

        // iframeの読み込み失敗時
        iframe.onerror = function () {
            if (isCompleted) return;
            isCompleted = true;
            console.warn(`HTMLファイルの読み込みに失敗しました: ${this.src}`);
            loadingDiv.remove();
            reject(new Error('iframe load failed'));
        };

        if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
                isCompleted = true;
                if (loadingDiv?.parentNode) loadingDiv.remove();
                if (iframe.parentNode) iframe.remove();
                reject(new Error('Aborted'));
            });
        }

        container.appendChild(iframe);
    });
}

// 情報パネルを閉じる関数
// パネルを閉じるときにiframeもクリーンアップ
/**
 * 情報パネルを閉じる
 * @returns {void}
 */
function closeInfoPanel() {
    document.getElementById('infoPanel').style.display = 'none';
    PanelState.isInfoOpen = false;
    PanelState.isRedPinInfoOpen = false;

    // 既存のiframeを削除してメモリリークを防ぐ
    const iframes = document.querySelectorAll('[id$="_iframe"]');
    iframes.forEach((iframe) => iframe.remove());

    // 凡例を元の位置に戻す
    adjustVectorLegendPosition(false);
}

// タブを切り替える関数
/**
 * タブを切り替える
 * @param {Event} e - クリックイベント
 * @returns {void}
 */
function switchTab(e) {
    // すべてのタブを非アクティブ化
    document.querySelectorAll('.tab-btn, .tab-content').forEach((el) => {
        el.classList.remove('active');
    });

    // クリックされたタブをアクティブ化
    e.target.classList.add('active');
    const tabId = e.target.dataset.tab;
    document.getElementById(`${tabId}Tab`).classList.add('active');
}

// モーダル初期化（DOMContentLoaded後に実行）
function initModal() {
    const modal = document.getElementById('iframeModal');
    const closeBtn = document.querySelector('.iframe-modal-close');

    // 閉じるボタンクリック
    closeBtn.addEventListener('click', closeModal);

    // オーバーレイクリック
    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    // ESCキー
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });
}

// モーダルを開く
/**
 * モーダルウィンドウを開く
 * @param {string} iframeUrl - 表示するiframeのURL
 * @param {string} [title='詳細情報'] - モーダルのタイトル
 * @returns {void}
 */
function openModal(iframeUrl, title = '詳細情報') {
    console.log('[Panel] モーダル表示:', title);

    const modal = document.getElementById('iframeModal');
    const modalTitle = document.querySelector('.iframe-modal-title');
    const modalIframe = document.getElementById('modalIframe');

    modalTitle.textContent = title;
    modalIframe.src = iframeUrl;
    modal.style.display = 'block';

    // ページスクロールを無効化
    document.body.style.overflow = 'hidden';
}

// モーダルを閉じる
/**
 * モーダルウィンドウを閉じる
 * @returns {void}
 */
function closeModal() {
    const modal = document.getElementById('iframeModal');
    const modalIframe = document.getElementById('modalIframe');

    modal.style.display = 'none';
    modalIframe.src = '';

    // ページスクロールを有効化
    document.body.style.overflow = 'auto';
}

// 情報パネルにモーダル表示ボタンを追加する関数
function addModalButtons() {
    const displayMode =
        projectConfig?.features?.detailPanel?.displayMode || 'image';

    if (displayMode !== 'iframe') return;

    // 各タブにモーダルボタンを追加
    for (let i = 1; i <= 3; i++) {
        const tabContent = document.getElementById(`info${i}Tab`);
        if (!tabContent) continue;

        // 既存のボタンを削除
        const existingBtn = tabContent.querySelector(`.modal-show-btn-${i}`);
        if (existingBtn) {
            existingBtn.remove();
        }

        // モーダル表示ボタンを作成
        const modalBtn = document.createElement('button');
        modalBtn.className = `modal-show-btn modal-show-btn-${i}`;
        modalBtn.textContent = 'Enlarge';
        modalBtn.disabled = true; // 初期状態では無効

        modalBtn.addEventListener('click', () => {
            const content = PanelState.currentModalContent[`tab${i}`];
            if (content && content.url) {
                openModal(content.url, `${content.title} - Tab${i}`);
            }
        });

        tabContent.appendChild(modalBtn);
    }
}

// モーダルボタンの状態更新
function updateModalButton(tabNumber, enabled) {
    const modalBtn = document.querySelector(`.modal-show-btn-${tabNumber}`);
    if (modalBtn) {
        modalBtn.disabled = !enabled;
    } else {
        console.warn(`Modal button for tab ${tabNumber} not found`);
        // ボタンが見つからない場合、少し待ってから再試行
        setTimeout(() => {
            const retryBtn = document.querySelector(
                `.modal-show-btn-${tabNumber}`
            );
            if (retryBtn) {
                retryBtn.disabled = !enabled;
            } else {
                console.error(
                    `Modal button for tab ${tabNumber} still not found after retry`
                );
            }
        }, 100);
    }
}

// アプリケーション終了時のクリーンアップ
/**
 * すべてのリクエストをクリーンアップする
 * @returns {void}
 */
function cleanupAllRequests() {
    // すべてのAbortControllerをキャンセル
    PanelState.activeAbortControllers.forEach((controller) => {
        controller.abort();
    });
    PanelState.activeAbortControllers.clear();

    // 現在のloadingTokenをキャンセル
    if (PanelState.currentLoadingToken) {
        PanelState.currentLoadingToken.canceled = true;
    }

    // すべてのローディング表示を削除
    const allLoadingDivs = document.querySelectorAll('.iframe-loading');
    allLoadingDivs.forEach((div) => {
        div.remove();
    });
}

// ページ離脱時のクリーンアップ
window.addEventListener('beforeunload', cleanupAllRequests);
