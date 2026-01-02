// メインアプリケーションの初期化と実行

// グローバル変数としてプロジェクト設定を保持
let projectConfig = null;

// DOMContentLoadedイベントでアプリケーションを初期化
document.addEventListener('DOMContentLoaded', function () {
    console.log('[Main] アプリケーション初期化開始');
    loadProjectConfig()
        .then(initializeApp)
        .catch((error) => {
            console.error('[Main] 初期化失敗:', error);
            alert('設定ファイルの読み込みに失敗しました。project_config.yaml を確認してください。');
        });
});

// アプリケーション初期化
function initializeApp() {
    console.log('[Main] アプリケーション初期化完了、機能初期化開始');

    initMap();
    initMarkerIcons();
    addLongitudeLines();

    if (isFeatureEnabled('rasterLayers.enabled')) {
        console.log('[Main] ラスターレイヤー機能: 有効');
        initLayers();
    } else {
        console.log('[Main] ラスターレイヤー機能: 無効');
    }

    if (isFeatureEnabled('vectorLayers.enabled')) {
        console.log('[Main] ベクターレイヤー機能: 有効');
        initVectorLayers();
    } else {
        console.log('[Main] ベクターレイヤー機能: 無効');
    }

    updateUIBasedOnConfig();
    console.log('[Main] UI更新完了');
    initEventListeners();
}

// プロジェクト設定を読み込む関数
async function loadProjectConfig() {
    const response = await fetch(AppConstants.urls.projectConfig);
    if (!response.ok) {
        throw new Error(`設定ファイルの読み込みに失敗: ${response.status}`);
    }

    const yamlText = await response.text();
    projectConfig = jsyaml.load(yamlText);

    console.log('[Main] プロジェクト設定読み込み完了:', projectConfig);
}

// 機能が有効かどうかをチェックする関数
function isFeatureEnabled(featurePath) {
    if (!projectConfig) return true; // 設定が読み込まれていない場合はデフォルトでtrue

    const parts = featurePath.split('.');
    let currentObj = projectConfig.features;

    for (const part of parts) {
        if (!currentObj || currentObj[part] === undefined) {
            return true; // 設定が存在しない場合はデフォルトでtrue
        }
        currentObj = currentObj[part];
    }

    return !!currentObj; // 値をブール値に変換して返す
}

// UIの表示/非表示を設定に基づいて制御する関数
function updateUIBasedOnConfig() {
    // ラスターレイヤー関連のUI制御
    if (!isFeatureEnabled('rasterLayers.enabled')) {
        hideElement('layerSelectionContainer');
        hideElement('activeLayersContainer');
    } else {
        // レイヤー選択パネル
        if (!isFeatureEnabled('rasterLayers.layerSelectionPanel')) {
            hideElement('layerSelectionContainer');
        }
        // レイヤー設定UI
        if (!isFeatureEnabled('rasterLayers.layerSettingsUI')) {
            hideElement('activeLayersContainer');
        }
    }
    // ベクターレイヤー関連のUI制御
    if (!isFeatureEnabled('vectorLayers.enabled')) {
        hideElement('vectorControlSection');
    } else {
        // ベクターレイヤーパネル
        if (!isFeatureEnabled('vectorLayers.layerPanel')) {
            hideElement('vectorControlSection');
        }
    }
    // マーカー関連のUI制御
    if (!isFeatureEnabled('markers.csvImport')) {
        hideElement('loadCSVButton');
    }
    // マップコントロール関連のUI制御
    if (!isFeatureEnabled('mapControls.homeButton')) {
        hideElement('homeButton');
    }
}

// 要素を非表示にする補助関数
function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

// イベントリスナーを初期化する関数
function initEventListeners() {
    // CSVファイル読み込みボタン（条件付き）
    if (isFeatureEnabled('markers.csvImport')) {
        const csvButton = document.getElementById('loadCSVButton');
        if (csvButton) {
            csvButton.addEventListener('click', loadCSVMarkers);
        }
    }

    // 情報パネルを閉じるボタン
    document
        .getElementById('closeButton')
        .addEventListener('click', closeInfoPanel);

    // タブ切り替え
    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', switchTab);
    });

    // HOMEボタン（条件付き）
    if (isFeatureEnabled('mapControls.homeButton')) {
        const homeButton = document.getElementById('homeButton');
        if (homeButton) {
            homeButton.addEventListener('click', function () {
                resetMapToInitialState(true);
                // ベクターレイヤーもリセット（条件付き）
                if (isFeatureEnabled('vectorLayers.enabled')) {
                    resetVectorLayers();
                }
            });
        }
    }

    // モーダルを初期化
    initModal();
}
